import React, { useState, useEffect, useRef } from 'react';
import ReactDOM from 'react-dom';
import { api, getBaseUrl, setBaseUrl } from './services/api';
import Login from './components/Login';
import DashboardStats from './components/DashboardStats';
import InventoryGrid from './components/InventoryGrid';
import ProductCatalogGrid from './components/ProductCatalogGrid';
import InventoryForm from './components/InventoryForm';
import BulkInwardModal from './components/BulkInwardModal';
import ReportsCenter from './components/ReportsCenter';
import SalesGrid from './components/SalesGrid';
import StockOutForm from './components/StockOutForm';
import CatalogManagerModal from './components/CatalogManagerModal';
import UnicommerceHub from './components/UnicommerceHub';
import MyntraHub from './components/MyntraHub';
import ReturnsManager from './components/ReturnsManager';
import JobCardPanel from './components/JobCardPanel';
import AdminPanel from './components/AdminPanel';
import Workspace from './components/Workspace';
import { 
  LogOut, 
  LayoutDashboard, 
  Database, 
  RefreshCw, 
  Server,
  ShoppingBag,
  BarChart3,
  Palette,
  Check,
  Printer,
  ShieldAlert,
  PackageMinus,
  ChevronDown,
  ChevronRight,
  Store,
  MessageSquare,
  BookOpen
} from 'lucide-react';

// ─── Theme definitions ─────────────────────────────────────────────────────
const THEMES = [
  {
    id: 'midnight',
    name: 'Premium Midnight',
    desc: 'Sleek dark mode — #0b0f19 canvas',
    swatchClass: 'swatch-midnight',
    accent: '#38bdf8',
  },
  {
    id: 'enterprise',
    name: 'Enterprise Classic',
    desc: 'Professional light mode — #f8fafc canvas',
    swatchClass: 'swatch-enterprise',
    accent: '#2563eb',
  },
  {
    id: 'cyberpunk',
    name: 'Cyberpunk Analytics',
    desc: 'High-contrast dark — #090d16 canvas',
    swatchClass: 'swatch-cyberpunk',
    accent: '#10b981',
  },
];

// ─── ThemePicker component ──────────────────────────────────────────────────
function ThemePicker({ currentTheme, onSelect }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    const handleClick = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  const current = THEMES.find(t => t.id === currentTheme) || THEMES[0];

  return (
    <div ref={ref} style={{ position: 'relative' }}>
      <button
        className="theme-btn"
        onClick={() => setOpen(o => !o)}
        title="Switch Theme"
      >
        <Palette size={14} />
        <span>{current.name}</span>
      </button>

      {open && ReactDOM.createPortal(
        <div className="theme-picker-dropdown">

          <div className="theme-picker-title">Choose Colour Theme</div>
          {THEMES.map(theme => (
            <button
              key={theme.id}
              className={`theme-option${currentTheme === theme.id ? ' active' : ''}`}
              onClick={() => { onSelect(theme.id); setOpen(false); }}
            >
              <div className={`theme-swatch ${theme.swatchClass}`} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div className="theme-info-name">{theme.name}</div>
                <div className="theme-info-desc">{theme.desc}</div>
              </div>
              {currentTheme === theme.id && <div className="theme-active-dot" />}
            </button>
          ))}
        </div>,
        document.body
      )}
    </div>
  );
}

export default function App() {
  const [isAuthenticated, setIsAuthenticated] = useState(api.isAuthenticated());
  const [currentUser, setCurrentUser] = useState(() => api.getCurrentUser());
  const [activeTab, setActiveTab] = useState('dashboard');
  const [items, setItems] = useState([]);
  const [catalogItems, setCatalogItems] = useState([]);
  const [sales, setSales] = useState([]);
  const [parties, setParties] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // Department state (digital_print vs elite_edition)
  const [activeDepartment, setActiveDepartment] = useState('digital_print');

  // Theme state — persisted to localStorage
  const [theme, setTheme] = useState(() => localStorage.getItem('elite_theme') || 'midnight');
  const [isEliteOnlineOpen, setIsEliteOnlineOpen] = useState(true);

  const getFirstJobCardsTab = () => {
    if (!currentUser || currentUser.role === 'admin') return 'jobcards';
    const subTabs = ['jobcards', 'jobcards_list', 'jobcards_catalogue', 'jobcards_tracking', 'jobcards_master', 'jobcards_fabric', 'jobcards_raw_materials', 'jobcards_settings'];
    const allowed = subTabs.filter(t => currentUser.permissions?.includes(t));
    return allowed[0] || 'jobcards';
  };

  // Sync activeDepartment when activeTab changes
  useEffect(() => {
    if (activeTab.startsWith('jobcards')) {
      setActiveDepartment('digital_print');
    } else if (['dashboard', 'elite_online', 'inventory', 'catalog', 'returns', 'sales', 'reports', 'unicommerce', 'myntra'].includes(activeTab)) {
      setActiveDepartment('elite_edition');
    }
  }, [activeTab]);

  const handleSwitchDepartment = (dept) => {
    setActiveDepartment(dept);
    if (dept === 'digital_print') {
      const firstTab = getFirstJobCardsTab();
      setActiveTab(firstTab);
    } else {
      setActiveTab('dashboard');
    }
  };

  // Auto-switch to default allowed tab based on user permissions
  useEffect(() => {
    if (isAuthenticated && currentUser) {
      if (currentUser.role === 'admin') {
        const validAdminTabs = [
          'dashboard', 'inventory', 'catalog', 'sales', 'reports', 'unicommerce', 'myntra', 'admin',
          'jobcards', 'jobcards_list', 'jobcards_catalogue', 'jobcards_tracking', 'jobcards_master', 'jobcards_fabric', 'jobcards_raw_materials', 'jobcards_settings'
        ];
        if (!validAdminTabs.includes(activeTab)) {
          setActiveTab('dashboard');
        }
      } else if (currentUser.permissions && currentUser.permissions.length > 0) {
        if (!currentUser.permissions.includes(activeTab) && !(activeTab === 'catalog' && currentUser.permissions.includes('inventory'))) {
          setActiveTab(currentUser.permissions[0]);
        }
      } else {
        setActiveTab('no-access');
      }
    }
  }, [currentUser, isAuthenticated]);

  // Apply theme to <html> element
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('elite_theme', theme);
  }, [theme]);
  
  // Modal states
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingItem, setEditingItem] = useState(null);
  const [isStockOutOpen, setIsStockOutOpen] = useState(false);
  const [stockOutItem, setStockOutItem] = useState(null);
  const [isManagerOpen, setIsManagerOpen] = useState(false);
  const [managerTab, setManagerTab] = useState('vendors');
  const [isBulkInwardOpen, setIsBulkInwardOpen] = useState(false);

  // Server Toggle State in Header
  const [serverEndpoint, setServerEndpoint] = useState(getBaseUrl());
  const [showServerSettings, setShowServerSettings] = useState(false);
  const [tempUrl, setTempUrl] = useState(getBaseUrl().replace('/v1', ''));

  useEffect(() => {
    if (isAuthenticated) {
      fetchData();
      const intervalId = setInterval(() => {
        fetchData();
      }, 30000); // 30s auto-reload
      return () => clearInterval(intervalId);
    }
  }, [isAuthenticated]);

  const fetchData = async () => {
    setLoading(true);
    setError('');
    try {
      // Run all 4 requests in parallel — ~4x faster than sequential awaits
      const [inventoryResult, catalogResult, salesResult, partiesResult] = await Promise.allSettled([
        api.getInventory(),
        api.getProductsCatalog(),
        api.getSales({ limit: 1000 }),
        api.getParties(),
      ]);

      if (inventoryResult.status === 'fulfilled') {
        setItems(inventoryResult.value || []);
      }
      if (catalogResult.status === 'fulfilled') {
        setCatalogItems(catalogResult.value || []);
      } else {
        console.warn('Failed to fetch product catalog:', catalogResult.reason);
      }
      if (salesResult.status === 'fulfilled' && salesResult.value?.data) {
        setSales(salesResult.value.data);
      }
      if (partiesResult.status === 'fulfilled' && partiesResult.value) {
        setParties(partiesResult.value);
      }

      // Surface critical errors (inventory or sales failed)
      const criticalFail = [inventoryResult, salesResult].find(r => r.status === 'rejected');
      if (criticalFail) {
        setError(criticalFail.reason?.message || 'Some data failed to load.');
      }
    } catch (err) {
      setError(err.message || 'Failed to fetch dashboard analytics.');
    } finally {
      setLoading(false);
    }
  };

  const handleLoginSuccess = () => {
    setIsAuthenticated(true);
    setCurrentUser(api.getCurrentUser());
    setServerEndpoint(getBaseUrl());
  };

  const handleLogout = () => {
    api.logout();
    setIsAuthenticated(false);
    setCurrentUser(null);
    setItems([]);
    setSales([]);
  };

  // Catalog Sync Handler
  const handleSyncCatalog = async () => {
    setLoading(true);
    try {
      const res = await api.syncMissingProducts();
      alert(res.message || 'Product catalog sync triggered successfully!');
      await fetchData();
    } catch (err) {
      alert(err.message || 'Failed to sync catalog.');
    } finally {
      setLoading(false);
    }
  };

  // CRUD Handler Functions
  const handleAddSubmit = async (formData) => {
    setLoading(true);
    try {
      if (activeTab === 'catalog') {
        const payload = {
          skuCode: formData.skuCode,
          description: formData.itemName,
          brand: formData.party,
          size: formData.size,
          basePrice: formData.purchasePrice,
          price: formData.salePrice,
          imageUrl: formData.imageUrl
        };
        const newProduct = await api.createProductCatalog(payload);
        setCatalogItems(prev => [newProduct, ...prev]);
      } else if (activeTab === 'inventory') {
        const newItem = await api.createInventory(formData);
        setItems(prev => [newItem, ...prev]);
      }
      setIsFormOpen(false);
    } catch (err) {
      alert(err.message || 'Failed to create item.');
    } finally {
      setLoading(false);
    }
  };

  const handleEditSubmit = async (formData) => {
    if (!editingItem || !editingItem._id) return;
    setLoading(true);
    try {
      if (activeTab === 'catalog') {
        const payload = {
          skuCode: formData.skuCode,
          description: formData.itemName,
          brand: formData.party,
          size: formData.size,
          basePrice: formData.purchasePrice,
          price: formData.salePrice,
          imageUrl: formData.imageUrl
        };
        await api.updateProductCatalog(editingItem._id, payload);
        await fetchData();
      } else if (activeTab === 'inventory') {
        const updatedItem = await api.updateInventory(editingItem._id, formData);
        setItems(prev => prev.map(item => item._id === editingItem._id ? { ...item, ...updatedItem } : item));
      }
      setIsFormOpen(false);
      setEditingItem(null);
    } catch (err) {
      alert(err.message || 'Failed to update item.');
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteItem = async (id) => {
    if (activeTab === 'catalog') {
      if (!window.confirm('Are you sure you want to delete this product from catalog?')) return;
      setLoading(true);
      try {
        await api.deleteProductCatalog(id);
        setCatalogItems(prev => prev.filter(item => item._id !== id));
      } catch (err) {
        alert(err.message || 'Failed to delete product from catalog.');
      } finally {
        setLoading(false);
      }
    } else if (activeTab === 'inventory') {
      if (!window.confirm('Are you sure you want to delete this inventory item?')) return;
      setLoading(true);
      try {
        await api.deleteInventory(id);
        setItems(prev => prev.filter(item => item._id !== id));
      } catch (err) {
        alert(err.message || 'Failed to delete inventory item.');
      } finally {
        setLoading(false);
      }
    }
  };

  const handleBulkInwardSubmit = async (parsedItems) => {
    setLoading(true);
    try {
      const res = await api.bulkInward(parsedItems);
      alert(res.message || 'Bulk inward completed successfully!');
      setIsBulkInwardOpen(false);
      await fetchData();
    } catch (err) {
      alert(err.message || 'Failed to process bulk inward.');
    } finally {
      setLoading(false);
    }
  };

  const handleStockOutSubmit = async (payload) => {
    setLoading(true);
    try {
      await api.createStockOut(payload);
      setIsStockOutOpen(false);
      setStockOutItem(null);
      await fetchData();
    } catch (err) {
      alert(err.message || 'Failed to submit outward transaction.');
    } finally {
      setLoading(false);
    }
  };

  const triggerStockOutModal = (item = null) => {
    setStockOutItem(item);
    setIsStockOutOpen(true);
  };

  const triggerAddModal = () => {
    setEditingItem(null);
    setIsFormOpen(true);
  };

  const triggerEditModal = (item) => {
    if (activeTab === 'catalog') {
      const adapted = {
        _id: item._id,
        itemName: item.description || '',
        party: item.brand || 'Uniware',
        size: Array.isArray(item.size) ? item.size.join(', ') : item.size || '',
        purchasePrice: item.basePrice || 0.0,
        salePrice: item.price || 0.0,
        skuCode: item.skuCode || '',
        imageUrl: item.imageUrl || '',
        currentlyAvailableStock: item.inventorySnapshots?.inventory || 0,
        qty: item.inventorySnapshots?.inventory || 0
      };
      setEditingItem(adapted);
    } else {
      setEditingItem(item);
    }
    setIsFormOpen(true);
  };

  const triggerManagerModal = (tabName = 'vendors') => {
    setManagerTab(tabName);
    setIsManagerOpen(true);
  };

  // Update server endpoint dynamically
  const applyServerEndpoint = () => {
    setBaseUrl(tempUrl);
    setServerEndpoint(getBaseUrl());
    setShowServerSettings(false);
    fetchData();
  };

  if (!isAuthenticated) {
    return <Login onLoginSuccess={handleLoginSuccess} />;
  }

  return (
    <div style={styles.appContainer} className="app-container">
      {/* Top Navbar */}
      <header className="glass-panel" style={styles.header}>
        <div style={styles.headerLeft} className="header-left-wrap">
          <div style={styles.logoBadge}>
            {activeDepartment === 'digital_print' ? 'EDP' : 'EE'}
          </div>
          <div>
            <h1 style={styles.brandTitle}>
              {activeDepartment === 'digital_print' ? 'Elite Digital Print' : 'Elite Edition'}
            </h1>
            <p style={styles.brandSubtitle}>
              {activeDepartment === 'digital_print' ? 'Digital Printing & Job Cards' : 'Inventory Control Center'}
            </p>
          </div>

          {/* Department Switcher Buttons */}
          <div className="dept-switcher-header">
            <button
              onClick={() => handleSwitchDepartment('digital_print')}
              className={`dept-switch-btn ${activeDepartment === 'digital_print' ? 'active' : ''}`}
              title="Switch to Elite Digital Print Department"
            >
              <Printer size={15} />
              <span>Elite Digital Print</span>
            </button>
            <button
              onClick={() => handleSwitchDepartment('elite_edition')}
              className={`dept-switch-btn ${activeDepartment === 'elite_edition' ? 'active' : ''}`}
              title="Switch to Elite Edition E-Commerce Department"
            >
              <Store size={15} />
              <span>Elite Edition</span>
            </button>
          </div>
        </div>

        <div style={styles.headerRight} className="header-right-wrap">
          {/* Theme Picker */}
          <ThemePicker currentTheme={theme} onSelect={setTheme} />

          {/* Active Server indicator */}
          <div style={styles.serverConfigContainer}>
            <button 
              onClick={() => setShowServerSettings(!showServerSettings)} 
              style={styles.serverBtn}
              title="Configure API Endpoint"
            >
              <Server size={14} color="var(--primary)" />
              <span style={styles.serverText}>Server Config</span>
            </button>
            
            {showServerSettings && (
              <div className="glass-panel" style={styles.serverDropdown}>
                <div style={styles.dropdownTitle}>API Target Settings</div>
                <input 
                  type="text" 
                  value={tempUrl} 
                  onChange={(e) => setTempUrl(e.target.value)}
                  style={styles.dropdownInput}
                  placeholder="http://localhost:3001"
                />
                <div style={styles.dropdownActions}>
                  <button 
                    onClick={() => setShowServerSettings(false)} 
                    className="btn-secondary" 
                    style={styles.dropActionBtn}
                  >
                    Cancel
                  </button>
                  <button 
                    onClick={applyServerEndpoint} 
                    className="btn-primary" 
                    style={styles.dropActionBtn}
                  >
                    Apply
                  </button>
                </div>
              </div>
            )}
          </div>

          <button onClick={fetchData} className="btn-icon" title="Reload Data">
            <RefreshCw size={15} className={loading ? 'spin-loader' : ''} />
          </button>

          <div style={styles.divider}></div>

          {currentUser && (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', marginRight: '0.75rem', alignSelf: 'center' }}>
              <span style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--text-primary)' }}>{currentUser.name}</span>
              <span style={{ fontSize: '0.65rem', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 600 }}>{currentUser.role || 'user'}</span>
            </div>
          )}

          <button onClick={handleLogout} className="btn-danger" style={styles.logoutBtn}>
            <LogOut size={15} />
            <span>Sign Out</span>
          </button>
        </div>
      </header>

      {/* Main Layout Grid */}
      <main style={styles.mainLayout} className="main-layout-grid">
        
        {/* Left Navigation and Reports Sidebar */}
        <aside style={styles.sidebar} className="sidebar-wrap">
          <div className="glass-panel" style={styles.navPanel}>
            {/* Dashboard */}
            {(!currentUser || currentUser.role === 'admin' || currentUser.permissions?.includes('dashboard')) && (
              <button
                onClick={() => setActiveTab('dashboard')}
                style={{ ...styles.navItem, ...(activeTab === 'dashboard' ? styles.navItemActive : {}) }}
              >
                <LayoutDashboard size={18} /><span>Dashboard Overview</span>
              </button>
            )}

            <button
              onClick={() => setActiveTab('workspace')}
              style={{ ...styles.navItem, ...(activeTab === 'workspace' ? styles.navItemActive : {}) }}
            >
              <MessageSquare size={18} /><span>Workspace / Chat</span>
            </button>

            {/* Elite Edition Online Submenu */}
            {(!currentUser || currentUser.role === 'admin' || 
              currentUser.permissions?.includes('inventory') || 
              currentUser.permissions?.includes('returns') || 
              currentUser.permissions?.includes('sales')) && (
              <div style={{ marginTop: '0.5rem', marginBottom: '0.5rem' }}>
                <button
                  onClick={() => {
                    setActiveTab('elite_online');
                    setIsEliteOnlineOpen(!isEliteOnlineOpen);
                  }}
                  style={{ ...styles.navItem, fontWeight: 'bold', paddingBottom: '0.5rem', color: 'var(--text-primary)', ...(activeTab === 'elite_online' || activeTab === 'inventory' || activeTab === 'returns' || activeTab === 'sales' ? styles.navItemActive : {}) }}
                >
                  <Store size={18} color="var(--primary)" />
                  <span style={{ flex: 1, textAlign: 'left' }}>Elite Edition Online</span>
                  {isEliteOnlineOpen ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                </button>

                {isEliteOnlineOpen && (
                  <div style={{ paddingLeft: '1rem', borderLeft: '1px solid rgba(255,255,255,0.1)', marginLeft: '0.5rem', display: 'flex', flexDirection: 'column', gap: '2px' }}>
                    <button onClick={() => setActiveTab('elite_online')} style={{ ...styles.navItem, padding: '0.5rem 0.75rem', fontSize: '0.8rem', ...(activeTab === 'elite_online' ? styles.navItemActive : {}) }}>
                      <BarChart3 size={16} /><span>Dashboard</span>
                    </button>
                    {(!currentUser || currentUser.role === 'admin' || currentUser.permissions?.includes('inventory')) && (
                      <>
                        <button onClick={() => setActiveTab('inventory')} style={{ ...styles.navItem, padding: '0.5rem 0.75rem', fontSize: '0.8rem', ...(activeTab === 'inventory' ? styles.navItemActive : {}) }}>
                          <Database size={16} /><span>Store Inventory</span>
                        </button>
                        <button onClick={() => setActiveTab('catalog')} style={{ ...styles.navItem, padding: '0.5rem 0.75rem', fontSize: '0.8rem', ...(activeTab === 'catalog' ? styles.navItemActive : {}) }}>
                          <BookOpen size={16} /><span>Product Catalog</span>
                        </button>
                      </>
                    )}
                    {(!currentUser || currentUser.role === 'admin' || currentUser.permissions?.includes('returns')) && (
                      <button onClick={() => setActiveTab('returns')} style={{ ...styles.navItem, padding: '0.5rem 0.75rem', fontSize: '0.8rem', ...(activeTab === 'returns' ? styles.navItemActive : {}) }}>
                        <PackageMinus size={16} /><span>Returns</span>
                      </button>
                    )}
                    {(!currentUser || currentUser.role === 'admin' || currentUser.permissions?.includes('sales')) && (
                      <button onClick={() => setActiveTab('sales')} style={{ ...styles.navItem, padding: '0.5rem 0.75rem', fontSize: '0.8rem', ...(activeTab === 'sales' ? styles.navItemActive : {}) }}>
                        <ShoppingBag size={16} /><span>Sales Orders</span>
                      </button>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* Other Standalone Tabs */}
            {(!currentUser || currentUser.role === 'admin' || currentUser.permissions?.includes('reports')) && (
              <button onClick={() => setActiveTab('reports')} style={{ ...styles.navItem, ...(activeTab === 'reports' ? styles.navItemActive : {}) }}>
                <BarChart3 size={18} /><span>Reports Center</span>
              </button>
            )}
            {(!currentUser || currentUser.role === 'admin' || currentUser.permissions?.includes('unicommerce')) && (
              <button onClick={() => setActiveTab('unicommerce')} style={{ ...styles.navItem, ...(activeTab === 'unicommerce' ? styles.navItemActive : {}) }}>
                <RefreshCw size={18} /><span>Uniware Integrations</span>
              </button>
            )}
            {(!currentUser || currentUser.role === 'admin' || currentUser.permissions?.includes('myntra')) && (
              <button onClick={() => setActiveTab('myntra')} style={{ ...styles.navItem, ...(activeTab === 'myntra' ? styles.navItemActive : {}) }}>
                <ShoppingBag size={18} /><span>Myntra Integrations</span>
              </button>
            )}
            {(!currentUser || currentUser.role === 'admin' || currentUser.permissions?.some(p => p.startsWith('jobcards'))) && (
              <div style={{ display: 'flex', flexDirection: 'column' }}>
                <button 
                  onClick={() => {
                    const firstAllowed = getFirstJobCardsTab();
                    setActiveTab(firstAllowed);
                  }}
                  style={{ ...styles.navItem, ...(activeTab.startsWith('jobcards') ? styles.navItemActive : {}) }}
                >
                  <Printer size={18} /><span>Elite Digital Print</span>
                  <ChevronDown size={14} style={{ marginLeft: 'auto', transform: activeTab.startsWith('jobcards') ? 'rotate(180deg)' : 'rotate(0deg)', transition: '0.2s' }} />
                </button>
                {activeTab.startsWith('jobcards') && (
                  <div style={{ display: 'flex', flexDirection: 'column', marginLeft: '1rem', marginTop: '0.25rem', gap: '0.25rem', borderLeft: '1px dashed var(--border-light)', paddingLeft: '0.5rem' }}>
                    {(!currentUser || currentUser.role === 'admin' || currentUser.permissions?.includes('jobcards')) && (
                      <button onClick={() => setActiveTab('jobcards')} style={{ ...styles.navSubItem, ...(activeTab === 'jobcards' ? styles.navSubItemActive : {}) }}>
                        Dashboard
                      </button>
                    )}
                    {(!currentUser || currentUser.role === 'admin' || currentUser.permissions?.includes('jobcards_list')) && (
                      <button onClick={() => setActiveTab('jobcards_list')} style={{ ...styles.navSubItem, ...(activeTab === 'jobcards_list' ? styles.navSubItemActive : {}) }}>
                        Job Card
                      </button>
                    )}
                    {(!currentUser || currentUser.role === 'admin' || currentUser.permissions?.includes('jobcards_catalogue')) && (
                      <button onClick={() => setActiveTab('jobcards_catalogue')} style={{ ...styles.navSubItem, ...(activeTab === 'jobcards_catalogue' ? styles.navSubItemActive : {}) }}>
                        Design Catalog
                      </button>
                    )}
                    {(!currentUser || currentUser.role === 'admin' || currentUser.permissions?.includes('jobcards_tracking')) && (
                      <button onClick={() => setActiveTab('jobcards_tracking')} style={{ ...styles.navSubItem, ...(activeTab === 'jobcards_tracking' ? styles.navSubItemActive : {}) }}>
                        Job Card Tracking
                      </button>
                    )}
                    {(!currentUser || currentUser.role === 'admin' || currentUser.permissions?.includes('jobcards_master')) && (
                      <button onClick={() => setActiveTab('jobcards_master')} style={{ ...styles.navSubItem, ...(activeTab === 'jobcards_master' ? styles.navSubItemActive : {}) }}>
                        Design Master (100 Pic)
                      </button>
                    )}
                    {(!currentUser || currentUser.role === 'admin' || currentUser.permissions?.includes('jobcards_fabric')) && (
                      <button onClick={() => setActiveTab('jobcards_fabric')} style={{ ...styles.navSubItem, ...(activeTab === 'jobcards_fabric' ? styles.navSubItemActive : {}) }}>
                        Fabric management
                      </button>
                    )}
                    {(!currentUser || currentUser.role === 'admin' || currentUser.permissions?.includes('jobcards_raw_materials')) && (
                      <button onClick={() => setActiveTab('jobcards_raw_materials')} style={{ ...styles.navSubItem, ...(activeTab === 'jobcards_raw_materials' ? styles.navSubItemActive : {}) }}>
                        Raw Materials
                      </button>
                    )}
                    {(!currentUser || currentUser.role === 'admin' || currentUser.permissions?.includes('jobcards_settings')) && (
                      <button onClick={() => setActiveTab('jobcards_settings')} style={{ ...styles.navSubItem, ...(activeTab === 'jobcards_settings' ? styles.navSubItemActive : {}) }}>
                        Settings
                      </button>
                    )}
                  </div>
                )}
              </div>
            )}

            {currentUser && currentUser.role === 'admin' && (
              <button
                onClick={() => setActiveTab('admin')}
                style={{
                  ...styles.navItem,
                  ...(activeTab === 'admin' ? styles.navItemActive : {}),
                  borderTop: '1px solid var(--border-light)',
                  marginTop: '0.5rem',
                  paddingTop: '0.75rem',
                }}
              >
                <ShieldAlert size={18} color="var(--primary)" />
                <span>Admin Panel</span>
              </button>
            )}

            {/* Theme quick-select dots */}
            <div style={styles.themeDotsRow}>
              {THEMES.map(t => (
                <button
                  key={t.id}
                  title={t.name}
                  onClick={() => setTheme(t.id)}
                  style={{
                    ...styles.themeDot,
                    background: t.accent,
                    outline: theme === t.id ? `2px solid ${t.accent}` : '2px solid transparent',
                    outlineOffset: '2px',
                    transform: theme === t.id ? 'scale(1.25)' : 'scale(1)',
                  }}
                />
              ))}
            </div>
          </div>
        </aside>

        {/* Right Content Panel */}
        <section style={styles.contentArea}>
          {error && <div style={styles.globalError}>{error}</div>}

          {activeTab === 'dashboard' ? (
            <DashboardStats items={items} sales={sales} />
          ) : activeTab === 'elite_online' ? (
            <ReportsCenter department="elite-online" />
          ) : activeTab === 'inventory' ? (
            <InventoryGrid
              items={items}
              onAdd={triggerAddModal}
              onEdit={triggerEditModal}
              onDelete={handleDeleteItem}
              onStockOut={triggerStockOutModal}
              onOpenManager={() => triggerManagerModal('vendors')}
              onBulkInward={() => setIsBulkInwardOpen(true)}
            />
          ) : activeTab === 'catalog' ? (
            <ProductCatalogGrid
              items={catalogItems}
              onAdd={triggerAddModal}
              onEdit={triggerEditModal}
              onDelete={handleDeleteItem}
              onSync={handleSyncCatalog}
            />
          ) : activeTab === 'returns' ? (
            <ReturnsManager />
          ) : activeTab === 'sales' ? (
            <SalesGrid />
          ) : activeTab === 'reports' ? (
            <ReportsCenter />
          ) : activeTab.startsWith('jobcards') ? (
            <JobCardPanel activeSubTab={activeTab === 'jobcards' ? 'jobcards' : activeTab.replace('jobcards_', '')} />
          ) : activeTab === 'unicommerce' ? (
            <UnicommerceHub />
          ) : activeTab === 'myntra' ? (
            <MyntraHub />
          ) : activeTab === 'workspace' ? (
            <Workspace currentUser={currentUser} />
          ) : activeTab === 'admin' ? (
            <AdminPanel />
          ) : (
            <div style={styles.noAccessContainer}>
              <ShieldAlert size={48} color="var(--primary)" />
              <h3 style={{ marginTop: '1rem', color: 'var(--text-primary)' }}>Access Restricted</h3>
              <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', marginTop: '0.5rem', textAlign: 'center' }}>
                You do not have permission to view any screen. Please contact your system administrator.
              </p>
            </div>
          )}
        </section>
      </main>

      {/* Modal Dialog */}
      {isFormOpen && (
        <InventoryForm
          item={editingItem}
          onSubmit={editingItem ? handleEditSubmit : handleAddSubmit}
          onClose={() => {
            setIsFormOpen(false);
            setEditingItem(null);
          }}
        />
      )}

      {isStockOutOpen && (
        <StockOutForm
          items={items}
          parties={parties}
          prefilledItem={stockOutItem}
          onSubmit={handleStockOutSubmit}
          onClose={() => {
            setIsStockOutOpen(false);
            setStockOutItem(null);
          }}
        />
      )}

      {isManagerOpen && (
        <CatalogManagerModal
          initialTab={managerTab}
          onClose={() => {
            setIsManagerOpen(false);
            fetchData();
          }}
        />
      )}

      {isBulkInwardOpen && (
        <BulkInwardModal
          onSubmit={handleBulkInwardSubmit}
          onClose={() => setIsBulkInwardOpen(false)}
        />
      )}

      {/* Loading Overlay */}
      {loading && items.length === 0 && sales.length === 0 && (
        <div style={styles.loadingOverlay}>
          <div style={styles.loaderBox}>
            <RefreshCw size={36} className="spin-loader" color="var(--primary)" />
            <p style={{ marginTop: '1rem', fontWeight: '500' }}>Fetching database analytics...</p>
          </div>
        </div>
      )}
    </div>
  );
}

const styles = {
  noAccessContainer: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '4rem 2rem',
    background: 'rgba(255, 255, 255, 0.02)',
    border: '1px solid var(--border-light)',
    borderRadius: 'var(--radius-lg)',
    minHeight: '400px'
  },
  appContainer: {
    maxWidth: '1280px',
    margin: '0 auto',
    padding: '1.5rem',
    display: 'flex',
    flexDirection: 'column',
    gap: '1.5rem',
    minHeight: '100vh',
  },
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '1rem 1.5rem',
    flexWrap: 'wrap',
    gap: '1rem',
  },
  headerLeft: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.75rem',
  },
  logoBadge: {
    width: '40px',
    height: '40px',
    borderRadius: '10px',
    background: 'linear-gradient(135deg, var(--primary), #0891b2)',
    color: '#fff',
    fontWeight: '700',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: '1.1rem',
  },
  brandTitle: {
    fontSize: '1.2rem',
    fontWeight: '700',
    lineHeight: '1.2',
  },
  brandSubtitle: {
    fontSize: '0.75rem',
    color: 'var(--text-muted)',
    marginTop: '2px',
  },
  headerRight: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.8rem',
  },
  divider: {
    width: '1px',
    height: '24px',
    background: 'var(--border-light)',
  },
  logoutBtn: {
    padding: '0.5rem 1rem',
    fontSize: '0.8rem',
  },
  mainLayout: {
    display: 'grid',
    gridTemplateColumns: '280px 1fr',
    gap: '1.5rem',
    alignItems: 'flex-start',
  },
  sidebar: {
    display: 'flex',
    flexDirection: 'column',
    gap: '1.5rem',
  },
  navPanel: {
    padding: '0.5rem',
    display: 'flex',
    flexDirection: 'column',
    gap: '0.25rem',
  },
  navItem: {
    background: 'none',
    border: 'none',
    width: '100%',
    padding: '0.75rem 1rem',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'flex-start',
    gap: '0.75rem',
    borderRadius: 'var(--radius-sm)',
    color: 'var(--text-muted)',
    fontSize: '0.9rem',
    fontWeight: '500',
    cursor: 'pointer',
    textAlign: 'left',
    transition: 'all var(--transition-fast)',
  },
  navItemActive: {
    background: 'var(--nav-active-bg)',
    color: 'var(--text-primary)',
    fontWeight: '600',
    borderLeft: '3px solid var(--nav-active-border)',
    borderRadius: '0 var(--radius-sm) var(--radius-sm) 0',
    paddingLeft: 'calc(1rem - 3px)',
  },
  navSubItem: {
    background: 'none',
    border: 'none',
    width: '100%',
    padding: '0.55rem 1rem',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'flex-start',
    gap: '0.5rem',
    borderRadius: 'var(--radius-sm)',
    color: 'var(--text-muted)',
    fontSize: '0.85rem',
    fontWeight: '500',
    cursor: 'pointer',
    textAlign: 'left',
    transition: 'all var(--transition-fast)',
  },
  navSubItemActive: {
    background: 'rgba(255,255,255,0.05)',
    color: 'var(--text-primary)',
    fontWeight: '600',
  },
  themeDotsRow: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '0.5rem',
    marginTop: '0.5rem',
    padding: '0.5rem 0',
    borderTop: '1px solid var(--border-light)',
  },
  themeDot: {
    width: '14px',
    height: '14px',
    borderRadius: '50%',
    border: 'none',
    cursor: 'pointer',
    padding: 0,
    transition: 'all 0.2s ease',
    flexShrink: 0,
  },
  contentArea: {
    flex: 1,
    minWidth: 0, // prevents grid blowout
  },
  globalError: {
    background: 'rgba(239, 68, 68, 0.1)',
    border: '1px solid rgba(239, 68, 68, 0.2)',
    borderRadius: 'var(--radius-sm)',
    padding: '0.75rem 1rem',
    color: '#fca5a5',
    fontSize: '0.85rem',
    marginBottom: '1.2rem',
  },
  loadingOverlay: {
    position: 'fixed',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    background: 'rgba(3, 7, 18, 0.85)',
    zIndex: 9999,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  loaderBox: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    color: '#fff',
  },
  serverConfigContainer: {
    position: 'relative',
  },
  serverBtn: {
    background: 'rgba(255, 255, 255, 0.02)',
    border: '1px solid var(--border-light)',
    padding: '0.5rem 0.75rem',
    fontSize: '0.8rem',
    color: '#d1d5db',
    borderRadius: 'var(--radius-sm)',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    gap: '0.4rem',
    transition: 'all var(--transition-fast)',
  },
  serverText: {
    fontSize: '0.8rem',
    fontWeight: '500',
  },
  serverDropdown: {
    position: 'absolute',
    top: '110%',
    right: 0,
    width: '280px',
    padding: '1rem',
    zIndex: 100,
    display: 'flex',
    flexDirection: 'column',
    gap: '0.75rem',
    animation: 'slideUp 0.15s ease-out',
  },
  dropdownTitle: {
    fontSize: '0.8rem',
    fontWeight: '600',
    textTransform: 'uppercase',
    color: 'var(--text-primary)',
    letterSpacing: '0.02em',
  },
  dropdownInput: {
    width: '100%',
    fontSize: '0.8rem',
    padding: '0.5rem',
  },
  dropdownActions: {
    display: 'flex',
    justifyContent: 'flex-end',
    gap: '0.5rem',
  },
  dropActionBtn: {
    padding: '0.35rem 0.75rem',
    fontSize: '0.75rem',
  },
};

// Inject responsive grid stylesheet
const styleEl = document.createElement('style');
styleEl.innerHTML = `
  @media (max-width: 900px) {
    div[style*="display: grid; gridTemplateColumns: 280px 1fr"] {
      grid-template-columns: 1fr !important;
    }
    aside {
      display: grid !important;
      grid-template-columns: 1fr 1.2fr;
      gap: 1.2rem;
    }
  }
  @media (max-width: 600px) {
    aside {
      grid-template-columns: 1fr !important;
    }
  }
`;
document.head.appendChild(styleEl);
