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
import StitchingSettings from './components/StitchingSettings';
import AdminPanel from './components/AdminPanel';
import Workspace from './components/Workspace';
import EliteModalDialog from './components/EliteModalDialog';
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
  BookOpen,
  Layers,
  Settings,
  FileText,
  Menu,
  X,
  Bell,
  Scissors
} from 'lucide-react';

import NotificationToastContainer, { triggerPushNotification, requestNotificationPermission, NotificationHistoryDrawer, getNotificationHistory } from './components/NotificationToast';

// ─── Theme definitions ─────────────────────────────────────────────────────
const THEMES = [
  {
    id: 'enterprise',
    name: 'Enterprise Classic',
    desc: 'Professional light mode — #f8fafc canvas',
    swatchClass: 'swatch-enterprise',
    accent: '#2563eb',
  },
  {
    id: 'midnight',
    name: 'Premium Midnight',
    desc: 'Sleek dark mode — #0b0f19 canvas',
    swatchClass: 'swatch-midnight',
    accent: '#38bdf8',
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

// ─── SidePanelColorPicker component ──────────────────────────────────────────
const ACCENT_COLORS = [
  { id: 'cyan', label: 'Electric Cyan', hex: '#38bdf8' },
  { id: 'purple', label: 'Royal Purple', hex: '#8b5cf6' },
  { id: 'emerald', label: 'Emerald Cyber', hex: '#10b981' },
  { id: 'amber', label: 'Sunset Amber', hex: '#f59e0b' },
  { id: 'pink', label: 'Rose Neon', hex: '#ec4899' },
  { id: 'blue', label: 'Enterprise Blue', hex: '#2563eb' }
];

function SidePanelColorPicker() {
  const [activeColor, setActiveColor] = useState(() => localStorage.getItem('elite_side_panel_accent') || '#38bdf8');

  const applyColor = (hex) => {
    setActiveColor(hex);
    const root = document.documentElement;
    root.style.setProperty('--primary', hex);
    root.style.setProperty('--primary-dark', hex);
    root.style.setProperty('--primary-glow', hex + '33');
    root.style.setProperty('--nav-active-border', hex);
    root.style.setProperty('--nav-active-bg', hex + '1a');
    root.style.setProperty('--border-focus', hex + '80');
    localStorage.setItem('elite_side_panel_accent', hex);
  };

  useEffect(() => {
    const saved = localStorage.getItem('elite_side_panel_accent');
    if (saved) applyColor(saved);
  }, []);

  return (
    <div style={{
      marginTop: 'auto',
      paddingTop: '0.85rem',
      borderTop: '1px solid var(--border-light)',
      display: 'flex',
      flexDirection: 'column',
      gap: '0.4rem'
    }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <span style={{ fontSize: '0.7rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.04em', display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
          <Palette size={12} color="var(--primary)" /> Side Panel Theme
        </span>
      </div>
      <div style={{ display: 'flex', gap: '0.4rem', justifyContent: 'space-between' }}>
        {ACCENT_COLORS.map(c => (
          <button
            key={c.id}
            onClick={() => applyColor(c.hex)}
            title={c.label}
            style={{
              width: '22px',
              height: '22px',
              borderRadius: '50%',
              background: c.hex,
              border: activeColor === c.hex ? '2px solid #ffffff' : '1px solid transparent',
              boxShadow: activeColor === c.hex ? `0 0 8px ${c.hex}` : 'none',
              cursor: 'pointer',
              transition: 'transform 0.15s ease',
              padding: 0
            }}
            onMouseEnter={e => e.currentTarget.style.transform = 'scale(1.2)'}
            onMouseLeave={e => e.currentTarget.style.transform = 'scale(1)'}
          />
        ))}
      </div>
    </div>
  );
}

export default function App() {
  const getSavedNavState = () => {
    let savedTab = '';
    let savedDept = '';
    try {
      if (typeof window !== 'undefined' && window.location.hash) {
        savedTab = window.location.hash.replace('#', '').trim();
      }
      if (!savedTab && typeof localStorage !== 'undefined') {
        savedTab = localStorage.getItem('elite_active_tab') || '';
      }
      if (typeof localStorage !== 'undefined') {
        savedDept = localStorage.getItem('elite_active_dept') || '';
      }
    } catch (e) {}

    return {
      tab: savedTab || 'jobcards',
      dept: savedDept || 'digital_print'
    };
  };

  const initialNav = getSavedNavState();
  const [isAuthenticated, setIsAuthenticated] = useState(api.isAuthenticated());
  const [currentUser, setCurrentUser] = useState(() => api.getCurrentUser());
  const [activeTab, setActiveTab] = useState(initialNav.tab);
  const [items, setItems] = useState([]);
  const [catalogItems, setCatalogItems] = useState([]);
  const [sales, setSales] = useState([]);
  const [parties, setParties] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // Notification Toasts state
  const [toasts, setToasts] = useState([]);

  // Department state (digital_print vs elite_edition vs stitching)
  const [activeDepartment, setActiveDepartment] = useState(initialNav.dept);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [isMobile, setIsMobile] = useState(() => typeof window !== 'undefined' && window.innerWidth < 768);

  // Preserve activeTab and activeDepartment across hard refreshes and browser history
  useEffect(() => {
    if (activeTab) {
      localStorage.setItem('elite_active_tab', activeTab);
      if (window.location.hash !== `#${activeTab}`) {
        window.history.replaceState(null, '', `#${activeTab}`);
      }
    }
  }, [activeTab]);

  useEffect(() => {
    if (activeDepartment) {
      localStorage.setItem('elite_active_dept', activeDepartment);
    }
  }, [activeDepartment]);

  useEffect(() => {
    const handleHashChange = () => {
      const hash = window.location.hash.replace('#', '').trim();
      if (hash && hash !== activeTab) {
        setActiveTab(hash);
      }
    };
    window.addEventListener('hashchange', handleHashChange);
    return () => window.removeEventListener('hashchange', handleHashChange);
  }, [activeTab]);

  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth < 768);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const isHasiUser = currentUser && (
    (currentUser.username && currentUser.username.toLowerCase() === 'hasi') ||
    (currentUser.name && currentUser.name.toLowerCase().includes('hasi'))
  );

  // Theme state — persisted to localStorage (default: Enterprise Classic)
  const [theme, setTheme] = useState(() => localStorage.getItem('elite_theme') || 'enterprise');
  const [isEliteOnlineOpen, setIsEliteOnlineOpen] = useState(true);

  // Department permission helpers
  const EE_PERMISSIONS = ['dashboard', 'elite_online', 'inventory', 'catalog', 'returns', 'sales', 'reports', 'unicommerce', 'myntra'];
  const EDP_PERMISSIONS = ['jobcards', 'jobcards_printing_log', 'jobcards_fabric', 'jobcards_billing', 'jobcards_engine', 'jobcards_list', 'jobcards_tracking', 'jobcards_catalogue', 'jobcards_master', 'jobcards_settings', 'jobcards_raw_materials'];
  const STITCHING_PERMISSIONS = [
    'stitching_jobcards', 'stitching_design', 'stitching_fabric', 'stitching_settings',
    'jobcards_list', 'jobcards_catalogue', 'jobcards_fabric',
    'jobcards_stitching_challan', 'jobcards_stitching_settings'
  ];

  const hasEliteEditionAccess = !currentUser || currentUser.role === 'admin' || (currentUser.permissions && currentUser.permissions.some(p => EE_PERMISSIONS.includes(p)));
  const hasDigitalPrintAccess = !currentUser || currentUser.role === 'admin' || (currentUser.permissions && currentUser.permissions.some(p => (EDP_PERMISSIONS.includes(p) || p.startsWith('jobcards')) && !p.startsWith('stitching_')));
  const hasStitchingAccess = !currentUser || currentUser.role === 'admin' || (currentUser.permissions && currentUser.permissions.some(p => STITCHING_PERMISSIONS.includes(p) || p.startsWith('stitching_')));
  const hasWorkspaceAccess = !currentUser || currentUser.role === 'admin' || !currentUser.permissions || currentUser.permissions.length === 0 || currentUser.permissions.includes('workspace');

  const getFirstJobCardsTab = () => {
    if (!currentUser || currentUser.role === 'admin') return 'jobcards';
    const subTabs = ['jobcards', 'jobcards_printing_log', 'jobcards_fabric', 'jobcards_billing', 'jobcards_engine', 'jobcards_list', 'jobcards_tracking', 'jobcards_catalogue', 'jobcards_master', 'jobcards_settings', 'jobcards_raw_materials'];
    const allowed = subTabs.filter(t => currentUser.permissions?.includes(t));
    return allowed[0] || 'jobcards';
  };

  const getFirstEETab = () => {
    if (!currentUser || currentUser.role === 'admin') return 'dashboard';
    const allowed = EE_PERMISSIONS.filter(t => currentUser.permissions?.includes(t));
    return allowed[0] || 'dashboard';
  };

  const getFirstStitchingTab = () => {
    if (!currentUser || currentUser.role === 'admin') return 'jobcards_list';
    const perms = currentUser.permissions || [];
    if (perms.includes('stitching_jobcards') || perms.includes('jobcards_list')) return 'jobcards_list';
    if (perms.includes('stitching_design') || perms.includes('jobcards_catalogue')) return 'jobcards_catalogue';
    if (perms.includes('stitching_fabric') || perms.includes('jobcards_stitching_challan') || perms.includes('jobcards_fabric')) return 'jobcards_stitching_challan';
    if (perms.includes('stitching_settings') || perms.includes('jobcards_stitching_settings')) return 'jobcards_stitching_settings';
    return 'jobcards_list';
  };

  // Sync activeDepartment when activeTab changes
  useEffect(() => {
    if (activeTab === 'jobcards_stitching_challan' || activeTab === 'jobcards_stitching_settings') {
      setActiveDepartment('stitching');
      return;
    }
    if (activeDepartment === 'stitching') return;
    if (activeTab.startsWith('jobcards')) {
      setActiveDepartment('digital_print');
    } else if (EE_PERMISSIONS.includes(activeTab)) {
      setActiveDepartment('elite_edition');
    }
  }, [activeTab, activeDepartment]);

  useEffect(() => {
    const handleNavTab = (e) => {
      if (e && e.detail) {
        setActiveTab(e.detail);
      }
    };
    window.addEventListener('elite-navigate-tab', handleNavTab);
    return () => window.removeEventListener('elite-navigate-tab', handleNavTab);
  }, []);

  // Auto-switch department if user lacks permission for current activeDepartment
  useEffect(() => {
    if (!currentUser || currentUser.role === 'admin') return;
    if (currentUser.permissions && currentUser.permissions.length > 0) {
      const allowedDepts = [];
      if (hasDigitalPrintAccess) allowedDepts.push('digital_print');
      if (hasStitchingAccess) allowedDepts.push('stitching');
      if (hasEliteEditionAccess) allowedDepts.push('elite_edition');

      if (allowedDepts.length > 0 && !allowedDepts.includes(activeDepartment)) {
        const targetDept = allowedDepts[0];
        setActiveDepartment(targetDept);
        if (activeTab !== 'workspace') {
          if (targetDept === 'stitching') setActiveTab(getFirstStitchingTab());
          else if (targetDept === 'digital_print') setActiveTab(getFirstJobCardsTab());
          else if (targetDept === 'elite_edition') setActiveTab(getFirstEETab());
        }
      }
    }
  }, [currentUser?.role, JSON.stringify(currentUser?.permissions || []), hasDigitalPrintAccess, hasStitchingAccess, hasEliteEditionAccess]);

  const handleNavClick = (tab) => {
    setActiveTab(tab);
    setMobileMenuOpen(false);
  };

  const handleSwitchDepartment = (dept) => {
    setActiveDepartment(dept);
    const deptName = dept === 'digital_print' ? 'Elite Digital Print' : dept === 'stitching' ? 'Elite Stitching' : 'Elite Edition';
    triggerPushNotification('Switched Department 🔄', `Now viewing ${deptName} modules.`, 'info');
    if (dept === 'digital_print') {
      const firstTab = getFirstJobCardsTab();
      setActiveTab(firstTab);
    } else if (dept === 'stitching') {
      const firstTab = getFirstStitchingTab();
      setActiveTab(firstTab);
    } else {
      const firstTab = getFirstEETab();
      setActiveTab(firstTab);
    }
  };

  // Auto-request Push Notification permission on site open
  useEffect(() => {
    if (isAuthenticated) {
      if ('Notification' in window && Notification.permission === 'default') {
        Notification.requestPermission().then(perm => {
          if (perm === 'granted') {
            triggerPushNotification('Push Notifications Active 🔔', 'You will receive real-time popups for Chat, Tasks, and Operations.', 'success');
          }
        }).catch(() => {});
      }
    }
  }, [isAuthenticated]);

  // Tab permission validation — ONLY reset activeTab if the tab is truly forbidden
  useEffect(() => {
    if (!isAuthenticated || !currentUser) return;

    const ALL_SYSTEM_TABS = [
      'dashboard', 'workspace', 'elite_online', 'inventory', 'catalog', 'returns', 'sales', 'reports', 'unicommerce', 'myntra', 'admin',
      'jobcards', 'jobcards_list', 'jobcards_catalogue', 'jobcards_tracking', 'jobcards_master', 'jobcards_fabric', 'jobcards_raw_materials', 'jobcards_settings',
      'jobcards_stitching_challan', 'jobcards_stitching_settings'
    ];

    if (currentUser.role === 'admin') {
      // Admins have access to all system tabs
      if (!ALL_SYSTEM_TABS.includes(activeTab)) {
        setActiveTab('dashboard');
      }
    } else if (currentUser.permissions && currentUser.permissions.length > 0) {
      // For non-admin users, check if activeTab or any parent category is allowed
      const isAllowed = currentUser.permissions.some(p => {
        if (p === activeTab) return true;
        if (activeTab === 'catalog' && p === 'inventory') return true;
        if (activeTab === 'jobcards_list' && (p === 'stitching_jobcards' || p === 'jobcards_list' || p === 'jobcards')) return true;
        if (activeTab === 'jobcards_catalogue' && (p === 'stitching_design' || p === 'jobcards_catalogue' || p === 'jobcards')) return true;
        if ((activeTab === 'jobcards_stitching_challan' || activeTab === 'jobcards_fabric') && (p === 'stitching_fabric' || p === 'jobcards_stitching_challan' || p === 'jobcards_fabric')) return true;
        if (activeTab === 'jobcards_stitching_settings' && (p === 'stitching_settings' || p === 'jobcards_stitching_settings')) return true;
        if (activeTab.startsWith('jobcards_') && (p === 'jobcards' || p === activeTab)) return true;
        if (activeTab === 'jobcards' && p.startsWith('jobcards')) return true;
        if (activeTab.startsWith('stitching_') && (p.startsWith('stitching_') || p === 'jobcards')) return true;
        return false;
      });

      if (!isAllowed && !['workspace', 'dashboard'].includes(activeTab)) {
        if (hasStitchingAccess && activeDepartment === 'stitching') {
          setActiveTab(getFirstStitchingTab());
        } else if (hasDigitalPrintAccess && activeDepartment === 'digital_print') {
          setActiveTab(getFirstJobCardsTab());
        } else if (hasEliteEditionAccess && activeDepartment === 'elite_edition') {
          setActiveTab(getFirstEETab());
        } else {
          setActiveTab(currentUser.permissions[0]);
        }
      }
    } else {
      setActiveTab('no-access');
    }
  }, [currentUser?.role, JSON.stringify(currentUser?.permissions || []), isAuthenticated, activeDepartment]);

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

  const [showNotificationDrawer, setShowNotificationDrawer] = useState(false);
  const [unreadNotifCount, setUnreadNotifCount] = useState(() => {
    return getNotificationHistory().filter(h => !h.read).length;
  });

  useEffect(() => {
    const handleNotifUpdate = () => {
      setUnreadNotifCount(getNotificationHistory().filter(h => !h.read).length);
    };
    window.addEventListener('elite-notification-history-update', handleNotifUpdate);
    return () => window.removeEventListener('elite-notification-history-update', handleNotifUpdate);
  }, []);

  useEffect(() => {
    if (isAuthenticated) {
      fetchData();
      const intervalId = setInterval(() => {
        fetchData();
      }, 10000); // 10s auto-sync

      const handleDataRefresh = () => {
        fetchData();
      };
      window.addEventListener('elite-data-refresh', handleDataRefresh);

      return () => {
        clearInterval(intervalId);
        window.removeEventListener('elite-data-refresh', handleDataRefresh);
      };
    }
  }, [isAuthenticated]);

  const fetchData = async () => {
    setLoading(true);
    setError('');
    try {
      // Run requests in parallel including user permissions sync
      const [inventoryResult, catalogResult, salesResult, partiesResult, userResult] = await Promise.allSettled([
        api.getInventory(),
        api.getProductsCatalog(),
        api.getSales({ limit: 1000 }),
        api.getParties(),
        api.refreshCurrentUser(),
      ]);

      if (userResult.status === 'fulfilled' && userResult.value) {
        setCurrentUser(userResult.value);
      }

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
      triggerGlobalDataRefresh();
      fetchData();
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
      } else if (activeTab === 'inventory') {
        const updatedItem = await api.updateInventory(editingItem._id, formData);
        setItems(prev => prev.map(item => item._id === editingItem._id ? { ...item, ...updatedItem } : item));
      }
      setIsFormOpen(false);
      setEditingItem(null);
      triggerGlobalDataRefresh();
      await fetchData();
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
        triggerGlobalDataRefresh();
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
        triggerGlobalDataRefresh();
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
      triggerGlobalDataRefresh();
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
          <button
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="mobile-menu-toggle"
            aria-label="Toggle Mobile Menu"
          >
            {mobileMenuOpen ? <X size={20} /> : <Menu size={20} />}
          </button>

          <div style={styles.logoBadge}>
            {activeTab === 'workspace' ? 'WS' : activeDepartment === 'digital_print' ? 'EDP' : activeDepartment === 'stitching' ? 'ES' : 'EE'}
          </div>
          <div>
            <h1 style={styles.brandTitle}>
              {activeTab === 'workspace' ? 'Workspace & Operations' : activeDepartment === 'digital_print' ? 'Elite Digital Print' : activeDepartment === 'stitching' ? 'Elite Stitching' : 'Elite Edition'}
            </h1>
            <p style={styles.brandSubtitle}>
              {activeTab === 'workspace' ? 'Team Collaboration & Real-Time Chat' : activeDepartment === 'digital_print' ? 'Digital Printing & Job Cards' : activeDepartment === 'stitching' ? 'Job Cards, Design Room & Fabric Challans' : 'Inventory Control Center'}
            </p>
          </div>

          {/* Department Switcher Buttons */}
          <div className="dept-switcher-header">
            {hasEliteEditionAccess && (
              <button
                onClick={() => handleSwitchDepartment('elite_edition')}
                className={`dept-switch-btn ${activeDepartment === 'elite_edition' && activeTab !== 'workspace' ? 'active' : ''}`}
                title="Switch to Elite Edition E-Commerce Department"
              >
                <Store size={15} />
                <span>Elite Edition</span>
              </button>
            )}

            {hasDigitalPrintAccess && (
              <button
                onClick={() => handleSwitchDepartment('digital_print')}
                className={`dept-switch-btn ${activeDepartment === 'digital_print' && activeTab !== 'workspace' ? 'active' : ''}`}
                title="Switch to Elite Digital Print Department"
              >
                <Printer size={15} />
                <span>Elite Digital Print</span>
              </button>
            )}

            {hasStitchingAccess && (
              <button
                onClick={() => handleSwitchDepartment('stitching')}
                className={`dept-switch-btn ${activeDepartment === 'stitching' && activeTab !== 'workspace' ? 'active' : ''}`}
                title="Switch to Elite Stitching Department"
              >
                <Scissors size={15} />
                <span>Elite Stitching</span>
              </button>
            )}

            {hasWorkspaceAccess && (
              <button
                onClick={() => { setActiveTab('workspace'); setMobileMenuOpen(false); }}
                className={`dept-switch-btn ${activeTab === 'workspace' ? 'active' : ''}`}
                title="Open Workspace / Chat"
              >
                <MessageSquare size={15} />
                <span>Workspace / Chat</span>
              </button>
            )}
          </div>
        </div>

        <div style={styles.headerRight} className="header-right-wrap">
          {/* Theme Picker & Server Config (Visible only to Hasi user) */}
          {isHasiUser && (
            <>
              <ThemePicker currentTheme={theme} onSelect={setTheme} />

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
            </>
          )}

          <button
            onClick={() => setShowNotificationDrawer(true)}
            className="btn-icon"
            title="Notification History & Push Alerts"
            style={{ position: 'relative' }}
          >
            <Bell size={15} color={unreadNotifCount > 0 ? 'var(--primary)' : typeof Notification !== 'undefined' && Notification.permission === 'granted' ? 'var(--success)' : 'var(--text-muted)'} />
            {unreadNotifCount > 0 && (
              <span style={{
                position: 'absolute',
                top: '-3px',
                right: '-3px',
                background: 'var(--primary)',
                color: '#fff',
                fontSize: '0.6rem',
                fontWeight: 800,
                borderRadius: '10px',
                padding: '1px 4px',
                minWidth: '14px',
                textAlign: 'center',
                lineHeight: 1,
                boxShadow: '0 0 8px rgba(56,189,248,0.6)'
              }}>
                {unreadNotifCount > 99 ? '99+' : unreadNotifCount}
              </span>
            )}
          </button>

          <button onClick={fetchData} className="btn-icon" title="Reload Data">
            <RefreshCw size={15} className={loading ? 'spin-loader' : ''} />
          </button>

          <div style={styles.divider}></div>

          {currentUser && (
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: '10px',
              backgroundColor: 'rgba(255, 255, 255, 0.04)',
              border: '1px solid var(--border-light)',
              borderRadius: '24px',
              padding: '4px 6px 4px 14px'
            }}>
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start' }}>
                <span style={{ fontSize: '0.82rem', fontWeight: 700, color: 'var(--text-primary)', lineHeight: 1.1 }}>{currentUser.name}</span>
                <span style={{ fontSize: '0.62rem', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 600 }}>{currentUser.role || 'user'}</span>
              </div>
              <button
                onClick={handleLogout}
                title="Sign Out"
                style={{
                  background: 'rgba(239, 68, 68, 0.12)',
                  border: '1px solid rgba(239, 68, 68, 0.25)',
                  color: '#ef4444',
                  borderRadius: '50%',
                  width: '32px',
                  height: '32px',
                  padding: 0,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  cursor: 'pointer',
                  transition: 'all 0.2s cubic-bezier(0.16, 1, 0.3, 1)',
                  boxShadow: '0 2px 8px rgba(239, 68, 68, 0.15)'
                }}
                className="logout-icon-btn"
              >
                <LogOut size={15} />
              </button>
            </div>
          )}
        </div>
      </header>

      {/* Mobile Navigation Drawer Overlay */}
      {mobileMenuOpen && (
        <div className="mobile-drawer-overlay" onClick={() => setMobileMenuOpen(false)}>
          <div className="mobile-drawer-content" onClick={(e) => e.stopPropagation()}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid var(--border-light)', paddingBottom: '0.75rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <div style={styles.logoBadge}>{activeDepartment === 'digital_print' ? 'EDP' : activeDepartment === 'stitching' ? 'ES' : 'EE'}</div>
                <span style={{ fontWeight: 700, fontSize: '0.95rem', color: 'var(--text-primary)' }}>
                  {activeDepartment === 'digital_print' ? 'Elite Digital Print' : activeDepartment === 'stitching' ? 'Elite Stitching' : 'Elite Edition'}
                </span>
              </div>
              <button onClick={() => setMobileMenuOpen(false)} style={{ background: 'none', border: 'none', color: 'var(--text-primary)', cursor: 'pointer', padding: '0.25rem' }}>
                <X size={20} />
              </button>
            </div>

            {/* Department Switcher Buttons inside Mobile Drawer */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', marginTop: '0.5rem' }}>
              {hasEliteEditionAccess && (
                <button
                  onClick={() => { handleSwitchDepartment('elite_edition'); setMobileMenuOpen(false); }}
                  className={`dept-switch-btn ${activeDepartment === 'elite_edition' && activeTab !== 'workspace' ? 'active' : ''}`}
                  style={{ width: '100%', justifyContent: 'center', padding: '0.65rem' }}
                >
                  <Store size={16} />
                  <span>Elite Edition</span>
                </button>
              )}
              {hasDigitalPrintAccess && (
                <button
                  onClick={() => { handleSwitchDepartment('digital_print'); setMobileMenuOpen(false); }}
                  className={`dept-switch-btn ${activeDepartment === 'digital_print' && activeTab !== 'workspace' ? 'active' : ''}`}
                  style={{ width: '100%', justifyContent: 'center', padding: '0.65rem' }}
                >
                  <Printer size={16} />
                  <span>Elite Digital Print</span>
                </button>
              )}
              {hasStitchingAccess && (
                <button
                  onClick={() => { handleSwitchDepartment('stitching'); setMobileMenuOpen(false); }}
                  className={`dept-switch-btn ${activeDepartment === 'stitching' && activeTab !== 'workspace' ? 'active' : ''}`}
                  style={{ width: '100%', justifyContent: 'center', padding: '0.65rem' }}
                >
                  <Scissors size={16} />
                  <span>Elite Stitching</span>
                </button>
              )}
              {hasWorkspaceAccess && (
                <button
                  onClick={() => { setActiveTab('workspace'); setMobileMenuOpen(false); }}
                  className={`dept-switch-btn ${activeTab === 'workspace' ? 'active' : ''}`}
                  style={{ width: '100%', justifyContent: 'center', padding: '0.65rem' }}
                >
                  <MessageSquare size={16} />
                  <span>Workspace / Chat</span>
                </button>
              )}
            </div>

            {/* Modules List inside Mobile Drawer */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem', marginTop: '0.75rem' }}>
              {activeTab === 'workspace' ? (
                <div style={{ padding: '0.75rem', background: 'rgba(255,255,255,0.03)', borderRadius: '8px', border: '1px solid var(--border-light)' }}>
                  <div style={styles.sidebarSectionHeader}>
                    <MessageSquare size={14} color="var(--primary)" />
                    <span>Workspace & Chat Active</span>
                  </div>
                  <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)', margin: '0.4rem 0 0' }}>
                    Access chats, channels & team updates in main view.
                  </p>
                </div>
              ) : activeDepartment === 'stitching' ? (
                <>
                  <div style={styles.sidebarSectionHeader}>
                    <Scissors size={14} color="var(--primary)" />
                    <span>Elite Stitching Modules</span>
                  </div>

                  {/* 1. Jobcard */}
                  {(!currentUser || currentUser.role === 'admin' || currentUser.permissions?.includes('jobcards_list') || currentUser.permissions?.includes('stitching_jobcards')) && (
                    <button onClick={() => { setActiveTab('jobcards_list'); setMobileMenuOpen(false); }} style={{ ...styles.navItem, ...(activeTab === 'jobcards_list' ? styles.navItemActive : {}) }}>
                      <FileText size={18} /><span>Jobcard</span>
                    </button>
                  )}
                  {/* 2. Design room */}
                  {(!currentUser || currentUser.role === 'admin' || currentUser.permissions?.includes('jobcards_catalogue') || currentUser.permissions?.includes('stitching_design')) && (
                    <button onClick={() => { setActiveTab('jobcards_catalogue'); setMobileMenuOpen(false); }} style={{ ...styles.navItem, ...(activeTab === 'jobcards_catalogue' ? styles.navItemActive : {}) }}>
                      <BookOpen size={18} /><span>Design room</span>
                    </button>
                  )}
                  {/* 3. Challan */}
                  {(!currentUser || currentUser.role === 'admin' || currentUser.permissions?.includes('jobcards_fabric') || currentUser.permissions?.includes('jobcards_stitching_challan') || currentUser.permissions?.includes('stitching_fabric')) && (
                    <button onClick={() => { setActiveTab('jobcards_stitching_challan'); setMobileMenuOpen(false); }} style={{ ...styles.navItem, ...((activeTab === 'jobcards_stitching_challan' || activeTab === 'jobcards_fabric') ? styles.navItemActive : {}) }}>
                      <Database size={18} /><span>Challan</span>
                    </button>
                  )}
                  {/* 4. Settings */}
                  {(!currentUser || currentUser.role === 'admin' || currentUser.permissions?.includes('jobcards_stitching_settings') || currentUser.permissions?.includes('stitching_settings')) && (
                    <button onClick={() => { setActiveTab('jobcards_stitching_settings'); setMobileMenuOpen(false); }} style={{ ...styles.navItem, ...(activeTab === 'jobcards_stitching_settings' ? styles.navItemActive : {}) }}>
                      <Settings size={18} /><span>Settings</span>
                    </button>
                  )}
                </>
              ) : activeDepartment === 'digital_print' ? (
                <>
                  <div style={styles.sidebarSectionHeader}>
                    <Printer size={14} color="var(--primary)" />
                    <span>Digital Print Modules</span>
                  </div>

                  {/* 1. Prints Dashboard & Reports */}
                  {(!currentUser || currentUser.role === 'admin' || currentUser.permissions?.includes('jobcards')) && (
                    <button onClick={() => { setActiveTab('jobcards'); setMobileMenuOpen(false); }} style={{ ...styles.navItem, ...(activeTab === 'jobcards' ? styles.navItemActive : {}) }}>
                      <BarChart3 size={18} /><span>Prints Dashboard</span>
                    </button>
                  )}
                  {/* 2. Printing Dipartment */}
                  {(!currentUser || currentUser.role === 'admin' || currentUser.permissions?.includes('jobcards_printing_log')) && (
                    <button onClick={() => { setActiveTab('jobcards_printing_log'); setMobileMenuOpen(false); }} style={{ ...styles.navItem, ...(activeTab === 'jobcards_printing_log' ? styles.navItemActive : {}) }}>
                      <Printer size={18} /><span>Printing Dipartment</span>
                    </button>
                  )}
                  {/* 2. Fabric Management */}
                  {(!currentUser || currentUser.role === 'admin' || currentUser.permissions?.includes('jobcards_fabric')) && (
                    <button onClick={() => { setActiveTab('jobcards_fabric'); setMobileMenuOpen(false); }} style={{ ...styles.navItem, ...(activeTab === 'jobcards_fabric' ? styles.navItemActive : {}) }}>
                      <Database size={18} /><span>Fabric Management</span>
                    </button>
                  )}
                  {/* Billing & Invoicing */}
                  {(!currentUser || currentUser.role === 'admin' || currentUser.permissions?.includes('jobcards_billing')) && (
                    <button onClick={() => { setActiveTab('jobcards_billing'); setMobileMenuOpen(false); }} style={{ ...styles.navItem, ...(activeTab === 'jobcards_billing' ? styles.navItemActive : {}) }}>
                      <FileText size={18} /><span>Billing & Invoicing</span>
                    </button>
                  )}
                  {/* 3. Job Card */}
                  {(!currentUser || currentUser.role === 'admin' || currentUser.permissions?.includes('jobcards_list')) && (
                    <button onClick={() => { setActiveTab('jobcards_list'); setMobileMenuOpen(false); }} style={{ ...styles.navItem, ...(activeTab === 'jobcards_list' ? styles.navItemActive : {}) }}>
                      <FileText size={18} /><span>Job Card</span>
                    </button>
                  )}
                  {/* 4. Job Card Tracking */}
                  {(!currentUser || currentUser.role === 'admin' || currentUser.permissions?.includes('jobcards_tracking')) && (
                    <button onClick={() => { setActiveTab('jobcards_tracking'); setMobileMenuOpen(false); }} style={{ ...styles.navItem, ...(activeTab === 'jobcards_tracking' ? styles.navItemActive : {}) }}>
                      <RefreshCw size={18} /><span>Job Card Tracking</span>
                    </button>
                  )}
                  {/* 5. Design Catalog */}
                  {(!currentUser || currentUser.role === 'admin' || currentUser.permissions?.includes('jobcards_catalogue')) && (
                    <button onClick={() => { setActiveTab('jobcards_catalogue'); setMobileMenuOpen(false); }} style={{ ...styles.navItem, ...(activeTab === 'jobcards_catalogue' ? styles.navItemActive : {}) }}>
                      <BookOpen size={18} /><span>Design Catalog</span>
                    </button>
                  )}
                  {/* 6. Design Master */}
                  {(!currentUser || currentUser.role === 'admin' || currentUser.permissions?.includes('jobcards_master')) && (
                    <button onClick={() => { setActiveTab('jobcards_master'); setMobileMenuOpen(false); }} style={{ ...styles.navItem, ...(activeTab === 'jobcards_master' ? styles.navItemActive : {}) }}>
                      <Layers size={18} /><span>Design Master</span>
                    </button>
                  )}
                  {/* 7. Print Settings */}
                  {(!currentUser || currentUser.role === 'admin' || currentUser.permissions?.includes('jobcards_settings')) && (
                    <button onClick={() => { setActiveTab('jobcards_settings'); setMobileMenuOpen(false); }} style={{ ...styles.navItem, ...(activeTab === 'jobcards_settings' ? styles.navItemActive : {}) }}>
                      <Settings size={18} /><span>Print Settings</span>
                    </button>
                  )}
                  {/* 8. Raw Materials */}
                  {(!currentUser || currentUser.role === 'admin' || currentUser.permissions?.includes('jobcards_raw_materials')) && (
                    <button onClick={() => { setActiveTab('jobcards_raw_materials'); setMobileMenuOpen(false); }} style={{ ...styles.navItem, ...(activeTab === 'jobcards_raw_materials' ? styles.navItemActive : {}) }}>
                      <ShoppingBag size={18} /><span>Raw Materials</span>
                    </button>
                  )}
                </>
              ) : (
                <>
                  <div style={styles.sidebarSectionHeader}>
                    <Store size={14} color="var(--primary)" />
                    <span>E-Commerce Modules</span>
                  </div>

                  {(!currentUser || currentUser.role === 'admin' || currentUser.permissions?.includes('dashboard')) && (
                    <button onClick={() => { setActiveTab('dashboard'); setMobileMenuOpen(false); }} style={{ ...styles.navItem, ...(activeTab === 'dashboard' ? styles.navItemActive : {}) }}>
                      <LayoutDashboard size={18} /><span>Dashboard Overview</span>
                    </button>
                  )}
                  {(!currentUser || currentUser.role === 'admin' || currentUser.permissions?.includes('inventory')) && (
                    <button onClick={() => { setActiveTab('inventory'); setMobileMenuOpen(false); }} style={{ ...styles.navItem, ...(activeTab === 'inventory' ? styles.navItemActive : {}) }}>
                      <Database size={18} /><span>Store Inventory</span>
                    </button>
                  )}
                  {(!currentUser || currentUser.role === 'admin' || currentUser.permissions?.includes('catalog')) && (
                    <button onClick={() => { setActiveTab('catalog'); setMobileMenuOpen(false); }} style={{ ...styles.navItem, ...(activeTab === 'catalog' ? styles.navItemActive : {}) }}>
                      <BookOpen size={18} /><span>Product Catalog</span>
                    </button>
                  )}
                  {(!currentUser || currentUser.role === 'admin' || currentUser.permissions?.includes('returns')) && (
                    <button onClick={() => { setActiveTab('returns'); setMobileMenuOpen(false); }} style={{ ...styles.navItem, ...(activeTab === 'returns' ? styles.navItemActive : {}) }}>
                      <PackageMinus size={18} /><span>Returns Department</span>
                    </button>
                  )}
                  {(!currentUser || currentUser.role === 'admin' || currentUser.permissions?.includes('sales')) && (
                    <button onClick={() => { setActiveTab('sales'); setMobileMenuOpen(false); }} style={{ ...styles.navItem, ...(activeTab === 'sales' ? styles.navItemActive : {}) }}>
                      <ShoppingBag size={18} /><span>Sales Orders</span>
                    </button>
                  )}
                  {(!currentUser || currentUser.role === 'admin' || currentUser.permissions?.includes('reports')) && (
                    <button onClick={() => { setActiveTab('reports'); setMobileMenuOpen(false); }} style={{ ...styles.navItem, ...(activeTab === 'reports' ? styles.navItemActive : {}) }}>
                      <BarChart3 size={18} /><span>Reports Center</span>
                    </button>
                  )}
                  {(!currentUser || currentUser.role === 'admin' || currentUser.permissions?.includes('unicommerce')) && (
                    <button onClick={() => { setActiveTab('unicommerce'); setMobileMenuOpen(false); }} style={{ ...styles.navItem, ...(activeTab === 'unicommerce' ? styles.navItemActive : {}) }}>
                      <RefreshCw size={18} /><span>Uniware Integrations</span>
                    </button>
                  )}
                  {(!currentUser || currentUser.role === 'admin' || currentUser.permissions?.includes('myntra')) && (
                    <button onClick={() => { setActiveTab('myntra'); setMobileMenuOpen(false); }} style={{ ...styles.navItem, ...(activeTab === 'myntra' ? styles.navItemActive : {}) }}>
                      <ShoppingBag size={18} /><span>Myntra Integrations</span>
                    </button>
                  )}
                </>
              )}

              {currentUser && currentUser.role === 'admin' && (
                <button onClick={() => { setActiveTab('admin'); setMobileMenuOpen(false); }} style={{ ...styles.navItem, ...(activeTab === 'admin' ? styles.navItemActive : {}) }}>
                  <ShieldAlert size={18} color="var(--primary)" /><span>Admin Panel</span>
                </button>
              )}
            </div>

            <div style={{ marginTop: 'auto', paddingTop: '1rem', borderTop: '1px solid var(--border-light)' }}>
              <button
                onClick={handleLogout}
                style={{
                  width: '100%',
                  justify: 'center',
                  padding: '12px',
                  borderRadius: '14px',
                  backgroundColor: 'rgba(239, 68, 68, 0.12)',
                  border: '1px solid rgba(239, 68, 68, 0.25)',
                  color: '#ef4444',
                  fontWeight: '600',
                  fontSize: '0.9rem',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  cursor: 'pointer',
                  transition: 'all 0.2s ease',
                  boxShadow: '0 4px 12px rgba(239, 68, 68, 0.15)'
                }}
                className="logout-icon-btn"
              >
                <LogOut size={16} /><span>Sign Out</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Main Layout */}
      <main style={styles.mainLayout} className="main-layout-container">
        
        {/* Left Navigation Sidebar */}
        <aside style={styles.sidebar} className="sidebar-wrap">
          <div className="glass-panel" style={styles.navPanel}>

            {activeTab === 'workspace' ? (
              <div style={{ padding: '0.75rem', background: 'rgba(255,255,255,0.03)', borderRadius: '8px', border: '1px solid var(--border-light)' }}>
                <div style={styles.sidebarSectionHeader}>
                  <MessageSquare size={14} color="var(--primary)" />
                  <span>Workspace & Operations</span>
                </div>
                <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)', margin: '0.5rem 0 0', lineHeight: 1.4 }}>
                  Collaborate in real time, view task boards, and chat with team members.
                </p>
              </div>
            ) : activeDepartment === 'stitching' ? (
              /* ── ELITE STITCHING MODULES ── */
              <>
                <div style={styles.sidebarSectionHeader}>
                  <Scissors size={14} color="var(--primary)" />
                  <span>Elite Stitching Modules</span>
                </div>

                {/* 1. Jobcard */}
                {(!currentUser || currentUser.role === 'admin' || currentUser.permissions?.includes('jobcards_list') || currentUser.permissions?.includes('stitching_jobcards')) && (
                  <button onClick={() => handleNavClick('jobcards_list')} style={{ ...styles.navItem, ...(activeTab === 'jobcards_list' ? styles.navItemActive : {}) }}>
                    <FileText size={18} /><span>Jobcard</span>
                  </button>
                )}
                {/* 2. Design room */}
                {(!currentUser || currentUser.role === 'admin' || currentUser.permissions?.includes('jobcards_catalogue') || currentUser.permissions?.includes('stitching_design')) && (
                  <button onClick={() => handleNavClick('jobcards_catalogue')} style={{ ...styles.navItem, ...(activeTab === 'jobcards_catalogue' ? styles.navItemActive : {}) }}>
                    <BookOpen size={18} /><span>Design room</span>
                  </button>
                )}
                {/* 3. Challan */}
                {(!currentUser || currentUser.role === 'admin' || currentUser.permissions?.includes('jobcards_fabric') || currentUser.permissions?.includes('jobcards_stitching_challan') || currentUser.permissions?.includes('stitching_fabric')) && (
                  <button onClick={() => handleNavClick('jobcards_stitching_challan')} style={{ ...styles.navItem, ...((activeTab === 'jobcards_stitching_challan' || activeTab === 'jobcards_fabric') ? styles.navItemActive : {}) }}>
                    <Database size={18} /><span>Challan</span>
                  </button>
                )}
                {/* 4. Settings */}
                {(!currentUser || currentUser.role === 'admin' || currentUser.permissions?.includes('jobcards_stitching_settings') || currentUser.permissions?.includes('stitching_settings')) && (
                  <button onClick={() => handleNavClick('jobcards_stitching_settings')} style={{ ...styles.navItem, ...(activeTab === 'jobcards_stitching_settings' ? styles.navItemActive : {}) }}>
                    <Settings size={18} /><span>Settings</span>
                  </button>
                )}
              </>
            ) : activeDepartment === 'digital_print' ? (
              /* ── ELITE DIGITAL PRINT MODULES ── */
              <>
                <div style={styles.sidebarSectionHeader}>
                  <Printer size={14} color="var(--primary)" />
                  <span>Digital Print Modules</span>
                </div>

                {/* 1. Prints Dashboard & Reports */}
                {(!currentUser || currentUser.role === 'admin' || currentUser.permissions?.includes('jobcards')) && (
                  <button onClick={() => handleNavClick('jobcards')} style={{ ...styles.navItem, ...(activeTab === 'jobcards' ? styles.navItemActive : {}) }}>
                    <BarChart3 size={18} /><span>Prints Dashboard & Reports</span>
                  </button>
                )}
                {/* 2. Printing Dipartment */}
                {(!currentUser || currentUser.role === 'admin' || currentUser.permissions?.includes('jobcards_printing_log')) && (
                  <button onClick={() => handleNavClick('jobcards_printing_log')} style={{ ...styles.navItem, ...(activeTab === 'jobcards_printing_log' ? styles.navItemActive : {}) }}>
                    <Printer size={18} /><span>Printing Dipartment</span>
                  </button>
                )}
                {/* 2. Fabric Management */}
                {(!currentUser || currentUser.role === 'admin' || currentUser.permissions?.includes('jobcards_fabric')) && (
                  <button onClick={() => handleNavClick('jobcards_fabric')} style={{ ...styles.navItem, ...(activeTab === 'jobcards_fabric' ? styles.navItemActive : {}) }}>
                    <Database size={18} /><span>Fabric Management</span>
                  </button>
                )}
                {/* Billing & Invoicing */}
                {(!currentUser || currentUser.role === 'admin' || currentUser.permissions?.includes('jobcards_billing')) && (
                  <button onClick={() => handleNavClick('jobcards_billing')} style={{ ...styles.navItem, ...(activeTab === 'jobcards_billing' ? styles.navItemActive : {}) }}>
                    <FileText size={18} /><span>Billing & Invoicing</span>
                  </button>
                )}
                {/* 3. Job Card */}
                {(!currentUser || currentUser.role === 'admin' || currentUser.permissions?.includes('jobcards_list')) && (
                  <button onClick={() => handleNavClick('jobcards_list')} style={{ ...styles.navItem, ...(activeTab === 'jobcards_list' ? styles.navItemActive : {}) }}>
                    <FileText size={18} /><span>Job Card</span>
                  </button>
                )}
                {/* 4. Job Card Tracking */}
                {(!currentUser || currentUser.role === 'admin' || currentUser.permissions?.includes('jobcards_tracking')) && (
                  <button onClick={() => handleNavClick('jobcards_tracking')} style={{ ...styles.navItem, ...(activeTab === 'jobcards_tracking' ? styles.navItemActive : {}) }}>
                    <RefreshCw size={18} /><span>Job Card Tracking</span>
                  </button>
                )}
                {/* 5. Design Catalog */}
                {(!currentUser || currentUser.role === 'admin' || currentUser.permissions?.includes('jobcards_catalogue')) && (
                  <button onClick={() => handleNavClick('jobcards_catalogue')} style={{ ...styles.navItem, ...(activeTab === 'jobcards_catalogue' ? styles.navItemActive : {}) }}>
                    <BookOpen size={18} /><span>Design Catalog</span>
                  </button>
                )}
                {/* 6. Design Master */}
                {(!currentUser || currentUser.role === 'admin' || currentUser.permissions?.includes('jobcards_master')) && (
                  <button onClick={() => handleNavClick('jobcards_master')} style={{ ...styles.navItem, ...(activeTab === 'jobcards_master' ? styles.navItemActive : {}) }}>
                    <Layers size={18} /><span>Design Master</span>
                  </button>
                )}
                {/* 7. Print Settings */}
                {(!currentUser || currentUser.role === 'admin' || currentUser.permissions?.includes('jobcards_settings')) && (
                  <button onClick={() => handleNavClick('jobcards_settings')} style={{ ...styles.navItem, ...(activeTab === 'jobcards_settings' ? styles.navItemActive : {}) }}>
                    <Settings size={18} /><span>Print Settings</span>
                  </button>
                )}
                {/* 8. Raw Materials */}
                {(!currentUser || currentUser.role === 'admin' || currentUser.permissions?.includes('jobcards_raw_materials')) && (
                  <button onClick={() => handleNavClick('jobcards_raw_materials')} style={{ ...styles.navItem, ...(activeTab === 'jobcards_raw_materials' ? styles.navItemActive : {}) }}>
                    <ShoppingBag size={18} /><span>Raw Materials</span>
                  </button>
                )}
              </>
            ) : (
              /* ── ELITE EDITION (E-COMMERCE) MODULES ── */
              <>
                <div style={styles.sidebarSectionHeader}>
                  <Store size={14} color="var(--primary)" />
                  <span>E-Commerce Modules</span>
                </div>

                {(!currentUser || currentUser.role === 'admin' || currentUser.permissions?.includes('dashboard')) && (
                  <button onClick={() => handleNavClick('dashboard')} style={{ ...styles.navItem, ...(activeTab === 'dashboard' ? styles.navItemActive : {}) }}>
                    <LayoutDashboard size={18} /><span>Dashboard Overview</span>
                  </button>
                )}
                {(!currentUser || currentUser.role === 'admin' || currentUser.permissions?.includes('inventory')) && (
                  <button onClick={() => handleNavClick('inventory')} style={{ ...styles.navItem, ...(activeTab === 'inventory' ? styles.navItemActive : {}) }}>
                    <Database size={18} /><span>Store Inventory</span>
                  </button>
                )}
                {(!currentUser || currentUser.role === 'admin' || currentUser.permissions?.includes('catalog')) && (
                  <button onClick={() => handleNavClick('catalog')} style={{ ...styles.navItem, ...(activeTab === 'catalog' ? styles.navItemActive : {}) }}>
                    <BookOpen size={18} /><span>Product Catalog</span>
                  </button>
                )}
                {(!currentUser || currentUser.role === 'admin' || currentUser.permissions?.includes('returns')) && (
                  <button onClick={() => handleNavClick('returns')} style={{ ...styles.navItem, ...(activeTab === 'returns' ? styles.navItemActive : {}) }}>
                    <PackageMinus size={18} /><span>Returns Department</span>
                  </button>
                )}
                {(!currentUser || currentUser.role === 'admin' || currentUser.permissions?.includes('sales')) && (
                  <button onClick={() => handleNavClick('sales')} style={{ ...styles.navItem, ...(activeTab === 'sales' ? styles.navItemActive : {}) }}>
                    <ShoppingBag size={18} /><span>Sales Orders</span>
                  </button>
                )}
                {(!currentUser || currentUser.role === 'admin' || currentUser.permissions?.includes('reports')) && (
                  <button onClick={() => handleNavClick('reports')} style={{ ...styles.navItem, ...(activeTab === 'reports' ? styles.navItemActive : {}) }}>
                    <BarChart3 size={18} /><span>Reports Center</span>
                  </button>
                )}
                {(!currentUser || currentUser.role === 'admin' || currentUser.permissions?.includes('unicommerce')) && (
                  <button onClick={() => handleNavClick('unicommerce')} style={{ ...styles.navItem, ...(activeTab === 'unicommerce' ? styles.navItemActive : {}) }}>
                    <RefreshCw size={18} /><span>Uniware Integrations</span>
                  </button>
                )}
                {(!currentUser || currentUser.role === 'admin' || currentUser.permissions?.includes('myntra')) && (
                  <button onClick={() => handleNavClick('myntra')} style={{ ...styles.navItem, ...(activeTab === 'myntra' ? styles.navItemActive : {}) }}>
                    <ShoppingBag size={18} /><span>Myntra Integrations</span>
                  </button>
                )}
              </>
            )}

            {currentUser && currentUser.role === 'admin' && (
              <button
                onClick={() => handleNavClick('admin')}
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

            {/* Side Panel Color Customizer for All Users */}
            <SidePanelColorPicker />

            {/* Theme quick-select dots (Visible only to Hasi user) */}
            {isHasiUser && (
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
            )}
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
            <JobCardPanel activeSubTab={activeTab === 'jobcards' ? 'jobcards' : activeTab.replace('jobcards_', '')} department={activeDepartment} />
          ) : activeTab === 'unicommerce' ? (
            <UnicommerceHub />
          ) : activeTab === 'myntra' ? (
            <MyntraHub />
          ) : activeTab === 'workspace' ? null : activeTab === 'admin' ? (
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

          {/* Persistent Workspace / Chat (always mounted to listen for socket notifications & record history) */}
          <div style={{ display: activeTab === 'workspace' ? 'block' : 'none', height: '100%' }}>
            <Workspace currentUser={currentUser} />
          </div>
        </section>
      </main>

      {/* Global Push / Toast Notifications Container */}
      <NotificationToastContainer toasts={toasts} setToasts={setToasts} />

      {/* Notification History Drawer */}
      <NotificationHistoryDrawer
        isOpen={showNotificationDrawer}
        onClose={() => setShowNotificationDrawer(false)}
        onSelectTab={(tab) => setActiveTab(tab)}
      />

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
      {/* Global Elite Glassmorphic Modal Dialog */}
      <EliteModalDialog />
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
    display: 'flex',
    width: '100%',
    gap: '1.5rem',
    alignItems: 'flex-start',
  },
  sidebar: {
    width: '260px',
    flexShrink: 0,
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
  sidebarSectionHeader: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.45rem',
    fontSize: '0.72rem',
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: '0.05em',
    color: 'var(--text-muted)',
    padding: '0.4rem 0.75rem',
    borderBottom: '1px solid var(--border-light)',
    marginBottom: '0.35rem',
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
