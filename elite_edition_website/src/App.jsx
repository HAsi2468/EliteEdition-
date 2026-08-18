import React, { useState, useEffect, useRef, lazy, Suspense } from 'react';
import ReactDOM from 'react-dom';
import { api, getBaseUrl, setBaseUrl } from './services/api';
import Login from './components/Login';
import DashboardStats from './components/DashboardStats';
import InventoryGrid from './components/InventoryGrid';
import ProductCatalogGrid from './components/ProductCatalogGrid';
import InventoryForm from './components/InventoryForm';
import BulkInwardModal from './components/BulkInwardModal';
import SalesGrid from './components/SalesGrid';
import StockOutForm from './components/StockOutForm';
import CatalogManagerModal from './components/CatalogManagerModal';
import JobCardPanel from './components/JobCardPanel';
import StitchingSettings from './components/StitchingSettings';
import AdminPanel from './components/AdminPanel';
import Workspace from './components/Workspace';
import CommunicationPanel from './components/CommunicationPanel';
import EliteModalDialog from './components/EliteModalDialog';
import CompanySettingsPanel from './components/CompanySettingsPanel';
import EliteBillingDepartment from './components/EliteBillingDepartment';
import CompanyDevelopmentWorkspace from './components/CompanyDevelopmentWorkspace';
import DigitalPrintComplainModule from './components/DigitalPrintComplainModule';
import DigitalPrintExpenseModule from './components/DigitalPrintExpenseModule';
import CompanyDedicatedDashboard from './components/CompanyDedicatedDashboard';
import GarmentJobCardDashboard from './components/GarmentJobCardDashboard';
import { COMPANIES, getCompanyById } from './config/companiesConfig';

// Code-splitting lazy loads for heavy tab modules
const ReportsCenter = lazy(() => import('./components/ReportsCenter'));
const UnicommerceHub = lazy(() => import('./components/UnicommerceHub'));
const MyntraHub = lazy(() => import('./components/MyntraHub'));
const ReturnsManager = lazy(() => import('./components/ReturnsManager'));
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
  AlertTriangle,
  PackageMinus,
  ChevronDown,
  ChevronRight,
  Store,
  MessageSquare,
  BookOpen,
  Layers,
  Settings,
  FileText,
  Wallet,
  Menu,
  X,
  Bell,
  Scissors,
  Building,
  Flame,
  Receipt,
  PanelLeftClose,
  PanelLeftOpen
} from 'lucide-react';

import NotificationToastContainer, { triggerPushNotification, triggerGlobalDataRefresh, requestNotificationPermission, NotificationHistoryDrawer, getNotificationHistory } from './components/NotificationToast';



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

  const [isEliteOnlineOpen, setIsEliteOnlineOpen] = useState(true);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(() => {
    const saved = localStorage.getItem('sidebar_collapsed');
    return saved === null ? true : saved === 'true';
  });

  const toggleSidebarCollapse = () => {
    setIsSidebarCollapsed(prev => {
      const next = !prev;
      localStorage.setItem('sidebar_collapsed', String(next));
      return next;
    });
  };

  // Department permission helpers
  // Department permission helpers
  const ELITE_ONLINE_PERMISSIONS = ['dashboard', 'elite_online', 'inventory', 'catalog', 'returns', 'sales', 'reports', 'unicommerce', 'myntra'];
  const EDP_PERMISSIONS = ['jobcards', 'jobcards_printing_log', 'jobcards_fabric', 'jobcards_billing', 'jobcards_engine', 'jobcards_list', 'jobcards_tracking', 'jobcards_catalogue', 'jobcards_master', 'jobcards_settings', 'jobcards_raw_materials', 'jobcards_complain', 'jobcards_complaints', 'complaint_dashboard', 'complaint_create', 'jobcards_expense', 'jobcards_expenses', 'expense_dashboard', 'expense_create'];
  const STITCHING_PERMISSIONS = [
    'stitching_jobcards', 'stitching_design', 'stitching_fabric', 'stitching_settings',
    'jobcards_stitching_challan', 'jobcards_stitching_settings', 'stitching'
  ];

  const hasEliteEditionAccess = !currentUser || currentUser.role === 'admin' || (currentUser.permissions && currentUser.permissions.some(p => ELITE_ONLINE_PERMISSIONS.includes(p)));
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
    const allowed = ELITE_ONLINE_PERMISSIONS.filter(t => currentUser.permissions?.includes(t));
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
    if (activeTab === 'jobcards_stitching_challan' || activeTab === 'jobcards_stitching_settings' || activeTab.startsWith('es_')) {
      setActiveDepartment('stitching');
      return;
    }
    if (activeDepartment === 'stitching' && (activeTab === 'jobcards_list' || activeTab === 'jobcards_catalogue' || activeTab === 'jobcards_fabric')) return;
    if (activeTab.startsWith('jobcards')) {
      setActiveDepartment('digital_print');
    } else if (activeTab.startsWith('ee_')) {
      setActiveDepartment('elite_edition');
    } else if (activeTab.startsWith('ef_')) {
      setActiveDepartment('elite_fabtex');
    } else if (activeTab.startsWith('eo_') || ELITE_ONLINE_PERMISSIONS.includes(activeTab)) {
      setActiveDepartment('elite_online');
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

  const isCompanyAllowed = (companyName) => {
    if (!currentUser) return false;
    if (currentUser.role === 'admin' || currentUser.isMainAdmin || currentUser.email === 'harshitsidapara2468@gmail.com') return true;
    if (Array.isArray(currentUser.allowedCompanies) && currentUser.allowedCompanies.length > 0) {
      return currentUser.allowedCompanies.includes(companyName);
    }
    return true;
  };

  // Auto-switch department if user lacks permission for current activeDepartment
  useEffect(() => {
    if (!currentUser || currentUser.role === 'admin') return;
    if (currentUser.permissions && currentUser.permissions.length > 0) {
      const allowedDepts = [];
      if (isCompanyAllowed('Elite Online') && hasEliteEditionAccess) allowedDepts.push('elite_online');
      if (isCompanyAllowed('Elite Digital Print') && hasDigitalPrintAccess) allowedDepts.push('digital_print');
      if (isCompanyAllowed('Elite Stitching') && hasStitchingAccess) allowedDepts.push('stitching');
      if (isCompanyAllowed('Elite Edition')) allowedDepts.push('elite_edition');
      if (isCompanyAllowed('Elite Fabtex')) allowedDepts.push('elite_fabtex');

      if (allowedDepts.length > 0 && !allowedDepts.includes(activeDepartment)) {
        const targetDept = allowedDepts[0];
        setActiveDepartment(targetDept);
        if (activeTab !== 'workspace') {
          if (targetDept === 'stitching') setActiveTab(getFirstStitchingTab());
          else if (targetDept === 'digital_print') setActiveTab(getFirstJobCardsTab());
          else if (targetDept === 'elite_edition') setActiveTab('ee_dashboard');
          else if (targetDept === 'elite_fabtex') setActiveTab('ef_dashboard');
          else if (targetDept === 'elite_online') setActiveTab(getFirstEETab());
        }
      }
    }
  }, [currentUser?.role, JSON.stringify(currentUser?.permissions || []), JSON.stringify(currentUser?.allowedCompanies || []), hasDigitalPrintAccess, hasStitchingAccess, hasEliteEditionAccess]);

  const handleNavClick = (tab) => {
    setActiveTab(tab);
    setMobileMenuOpen(false);
  };

  const handleSwitchDepartment = (dept) => {
    setActiveDepartment(dept);
    const comp = getCompanyById(dept);
    triggerPushNotification('Switched Department 🔄', `Now viewing ${comp.name} (${comp.type}).`, 'info');
    if (dept === 'digital_print') {
      const firstTab = getFirstJobCardsTab();
      setActiveTab(firstTab);
    } else if (dept === 'stitching') {
      setActiveTab('es_dashboard');
    } else if (dept === 'elite_edition') {
      setActiveTab('ee_dashboard');
    } else if (dept === 'elite_fabtex') {
      setActiveTab('ef_dashboard');
    } else if (dept === 'elite_online') {
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
      'ee_dashboard', 'ee_invoices', 'ee_settings', 'ee_complaints', 'ee_expenses',
      'ef_dashboard', 'ef_invoices', 'ef_settings', 'ef_complaints', 'ef_expenses',
      'es_dashboard', 'es_settings', 'es_complaints', 'es_expenses', 'eo_complaints', 'eo_expenses',
      'jobcards', 'jobcards_list', 'jobcards_catalogue', 'jobcards_tracking', 'jobcards_master', 'jobcards_fabric', 'jobcards_raw_materials', 'jobcards_settings',
      'jobcards_stitching_challan', 'jobcards_stitching_settings',
      'jobcards_printing_log', 'jobcards_fusing_log', 'jobcards_print_entry', 'jobcards_billing', 'jobcards_engine', 'jobcards_split_view', 'jobcards_challan', 'jobcards_complain', 'jobcards_expense'
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
        if (activeTab.startsWith('ee_') || activeTab.startsWith('ef_') || activeTab.startsWith('es_') || activeTab.startsWith('eo_')) return true;
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
      <header className="glass-panel app-header" style={styles.header}>
        <div style={styles.headerLeft} className="header-left-wrap">
          <button
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="mobile-menu-toggle"
            aria-label="Toggle Mobile Menu"
          >
            {mobileMenuOpen ? <X size={20} /> : <Menu size={20} />}
          </button>

          <div style={{ display: 'flex', alignItems: 'center', gap: '0.55rem' }}>
            <div style={{
              width: '32px',
              height: '32px',
              borderRadius: '8px',
              background: 'linear-gradient(135deg, var(--primary, #6366f1), #0891b2)',
              color: '#fff',
              fontWeight: 800,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '0.85rem',
              letterSpacing: '0.02em',
              flexShrink: 0,
              boxShadow: '0 2px 8px rgba(99,102,241,0.3)'
            }}>
              {activeTab === 'workspace' ? 'WS' : (getCompanyById(activeDepartment)?.code || 'EO')}
            </div>
            <span style={{ fontSize: '0.95rem', fontWeight: 800, color: 'var(--text-primary)', whiteSpace: 'nowrap' }}>
              {activeTab === 'workspace' ? 'Workspace' : (getCompanyById(activeDepartment)?.name || 'Elite Online')}
            </span>
          </div>

          {/* Master Company Switcher Buttons */}
          <div className="dept-switcher-header">
            {COMPANIES.map(company => {
              // Permission check
              if (!isCompanyAllowed(company.name)) return null;
              if (company.id === 'elite_online' && !hasEliteEditionAccess) return null;
              if (company.id === 'digital_print' && !hasDigitalPrintAccess) return null;
              if (company.id === 'stitching' && !hasStitchingAccess) return null;

              const IconComponent = company.iconName === 'Store' ? Store : company.iconName === 'Printer' ? Printer : company.iconName === 'Scissors' ? Scissors : Building;
              const isActive = activeDepartment === company.id && activeTab !== 'workspace';

              return (
                <button
                  key={company.id}
                  onClick={() => handleSwitchDepartment(company.id)}
                  className={`dept-switch-btn ${isActive ? 'active' : ''}`}
                  title={`Switch to ${company.name} Workspace (${company.type})`}
                >
                  <IconComponent size={15} />
                  <span>{company.name}</span>
                </button>
              );
            })}

            {hasWorkspaceAccess && (
              <button
                onClick={() => { setActiveTab('communication'); setMobileMenuOpen(false); }}
                className={`dept-switch-btn ${activeTab === 'communication' || activeTab === 'workspace' ? 'active' : ''}`}
                title="Open Department Communication & Activity Stream"
              >
                <MessageSquare size={15} />
                <span>Inter-Dept Communication</span>
              </button>
            )}
          </div>
        </div>

        <div style={styles.headerRight} className="header-right-wrap">
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
                  {/* 4. Complaints */}
                  <button onClick={() => { setActiveTab('es_complaints'); setMobileMenuOpen(false); }} style={{ ...styles.navItem, ...(activeTab === 'es_complaints' ? styles.navItemActive : {}) }}>
                    <AlertTriangle size={18} color="#f43f5e" /><span>Complaints</span>
                  </button>
                  {/* 5. Settings */}
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
                  {/* 2. Printing Department */}
                  {(!currentUser || currentUser.role === 'admin' || currentUser.permissions?.includes('jobcards_printing_log')) && (
                    <button onClick={() => { setActiveTab('jobcards_printing_log'); setMobileMenuOpen(false); }} style={{ ...styles.navItem, ...(activeTab === 'jobcards_printing_log' ? styles.navItemActive : {}) }}>
                      <Printer size={18} /><span>Printing Department</span>
                    </button>
                  )}
                  {/* Fusing Department */}
                  {(!currentUser || currentUser.role === 'admin' || currentUser.permissions?.includes('jobcards_fusing_log') || currentUser.permissions?.includes('jobcards')) && (
                    <button onClick={() => { setActiveTab('jobcards_fusing_log'); setMobileMenuOpen(false); }} style={{ ...styles.navItem, ...(activeTab === 'jobcards_fusing_log' ? styles.navItemActive : {}) }}>
                      <Flame size={18} /><span>Fusing Department</span>
                    </button>
                  )}
                  {/* 2. Fabric Management */}
                  {(!currentUser || currentUser.role === 'admin' || currentUser.permissions?.includes('jobcards_fabric')) && (
                    <button onClick={() => { setActiveTab('jobcards_fabric'); setMobileMenuOpen(false); }} style={{ ...styles.navItem, ...(activeTab === 'jobcards_fabric' ? styles.navItemActive : {}) }}>
                      <Database size={18} /><span>Fabric Management</span>
                    </button>
                  )}
                  {/* 3. Billing & Invoicing */}
                  {(!currentUser || currentUser.role === 'admin' || currentUser.permissions?.includes('jobcards_billing')) && (
                    <button onClick={() => { setActiveTab('jobcards_billing'); setMobileMenuOpen(false); }} style={{ ...styles.navItem, ...(activeTab === 'jobcards_billing' ? styles.navItemActive : {}) }}>
                      <Receipt size={18} /><span>Billing & Invoicing</span>
                    </button>
                  )}

                  {/* 3. Job Card */}
                  {(!currentUser || currentUser.role === 'admin' || currentUser.permissions?.includes('jobcards_list')) && (
                    <button onClick={() => { setActiveTab('jobcards_list'); setMobileMenuOpen(false); }} style={{ ...styles.navItem, ...(activeTab === 'jobcards_list' ? styles.navItemActive : {}) }}>
                      <FileText size={18} /><span>Job Card</span>
                    </button>
                  )}
                  {/* 5. Design Catalog */}
                  {(!currentUser || currentUser.role === 'admin' || currentUser.permissions?.includes('jobcards_catalogue') || currentUser.permissions?.includes('jobcards_master')) && (
                    <button onClick={() => { setActiveTab('jobcards_catalogue'); setMobileMenuOpen(false); }} style={{ ...styles.navItem, ...((activeTab === 'jobcards_catalogue' || activeTab === 'jobcards_master') ? styles.navItemActive : {}) }}>
                      <BookOpen size={18} /><span>Design Catalog</span>
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
                  {/* 9. Complain Module */}
                  {(!currentUser || currentUser.role === 'admin' || currentUser.permissions?.includes('jobcards_complain') || currentUser.permissions?.includes('jobcards_complaints') || currentUser.permissions?.includes('complaint_dashboard') || currentUser.permissions?.includes('complaint_create')) && (
                    <button onClick={() => { setActiveTab('jobcards_complain'); setMobileMenuOpen(false); }} style={{ ...styles.navItem, ...(activeTab === 'jobcards_complain' ? styles.navItemActive : {}) }}>
                      <AlertTriangle size={18} color="#f43f5e" /><span>Complain Module</span>
                    </button>
                  )}
                </>
              ) : activeDepartment === 'elite_edition' ? (
                <>
                  <div style={styles.sidebarSectionHeader}>
                    <Building size={14} color="var(--primary)" />
                    <span>Elite Edition Modules</span>
                  </div>
                  <button onClick={() => { setActiveTab('ee_dashboard'); setMobileMenuOpen(false); }} style={{ ...styles.navItem, ...(activeTab === 'ee_dashboard' ? styles.navItemActive : {}) }}>
                    <LayoutDashboard size={18} /><span>Dashboard</span>
                  </button>
                  <button onClick={() => { setActiveTab('ee_invoices'); setMobileMenuOpen(false); }} style={{ ...styles.navItem, ...(activeTab === 'ee_invoices' ? styles.navItemActive : {}) }}>
                    <Receipt size={18} /><span>Billing</span>
                  </button>
                  <button onClick={() => { setActiveTab('ee_complaints'); setMobileMenuOpen(false); }} style={{ ...styles.navItem, ...(activeTab === 'ee_complaints' ? styles.navItemActive : {}) }}>
                    <AlertTriangle size={18} color="#f43f5e" /><span>Complaints</span>
                  </button>
                  <button onClick={() => { setActiveTab('ee_settings'); setMobileMenuOpen(false); }} style={{ ...styles.navItem, ...(activeTab === 'ee_settings' ? styles.navItemActive : {}) }}>
                    <Settings size={18} /><span>Settings</span>
                  </button>
                </>
              ) : activeDepartment === 'elite_fabtex' ? (
                <>
                  <div style={styles.sidebarSectionHeader}>
                    <Building size={14} color="var(--primary)" />
                    <span>Elite Fabtex Modules</span>
                  </div>
                  <button onClick={() => { setActiveTab('ef_dashboard'); setMobileMenuOpen(false); }} style={{ ...styles.navItem, ...(activeTab === 'ef_dashboard' ? styles.navItemActive : {}) }}>
                    <LayoutDashboard size={18} /><span>Dashboard</span>
                  </button>
                  <button onClick={() => { setActiveTab('ef_invoices'); setMobileMenuOpen(false); }} style={{ ...styles.navItem, ...(activeTab === 'ef_invoices' ? styles.navItemActive : {}) }}>
                    <Receipt size={18} /><span>Billing</span>
                  </button>
                  <button onClick={() => { setActiveTab('ef_complaints'); setMobileMenuOpen(false); }} style={{ ...styles.navItem, ...(activeTab === 'ef_complaints' ? styles.navItemActive : {}) }}>
                    <AlertTriangle size={18} color="#f43f5e" /><span>Complaints</span>
                  </button>
                  <button onClick={() => { setActiveTab('ef_settings'); setMobileMenuOpen(false); }} style={{ ...styles.navItem, ...(activeTab === 'ef_settings' ? styles.navItemActive : {}) }}>
                    <Settings size={18} /><span>Settings</span>
                  </button>
                </>
              ) : (
                <>
                  <div style={styles.sidebarSectionHeader}>
                    <Store size={14} color="var(--primary)" />
                    <span>Elite Online Modules</span>
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
                  <button onClick={() => { setActiveTab('eo_complaints'); setMobileMenuOpen(false); }} style={{ ...styles.navItem, ...(activeTab === 'eo_complaints' ? styles.navItemActive : {}) }}>
                    <AlertTriangle size={18} color="#f43f5e" /><span>Complaints</span>
                  </button>
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
        <aside
          style={{
            width: isSidebarCollapsed ? '82px' : '260px',
            flexShrink: 0,
            display: 'flex',
            flexDirection: 'column',
            gap: '1rem',
            position: 'sticky',
            top: '62px',
            alignSelf: 'flex-start',
            maxHeight: 'calc(100vh - 74px)',
            overflowY: 'auto',
            transition: 'width 0.22s cubic-bezier(0.4, 0, 0.2, 1)',
            zIndex: 90
          }}
          className="sidebar-wrap"
        >
          <div className="glass-panel" style={{ padding: isSidebarCollapsed ? '0.4rem 0.25rem' : '0.5rem', display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
            {/* Collapse / Expand Toggle Button Header */}
            <div style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: isSidebarCollapsed ? 'center' : 'space-between',
              padding: '0.4rem 0.5rem',
              borderBottom: '1px solid var(--border-light)',
              marginBottom: '0.35rem'
            }}>
              {!isSidebarCollapsed && (
                <span style={{ fontSize: '0.7rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--text-muted)' }}>
                  Navigation
                </span>
              )}
              <button
                type="button"
                onClick={toggleSidebarCollapse}
                title={isSidebarCollapsed ? "Expand Sidebar" : "Collapse Sidebar"}
                style={{
                  background: isSidebarCollapsed ? 'rgba(99,102,241,0.12)' : 'transparent',
                  border: 'none',
                  borderRadius: '6px',
                  padding: '0.35rem',
                  color: 'var(--text-secondary)',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  transition: 'all 0.15s ease'
                }}
              >
                {isSidebarCollapsed ? <PanelLeftOpen size={18} color="var(--primary)" /> : <PanelLeftClose size={18} />}
              </button>
            </div>

            {(() => {
              const renderNavItem = (tabKey, label, IconComponent, customColor, shortLabel) => {
                const isActive = activeTab === tabKey || (tabKey === 'jobcards_stitching_challan' && activeTab === 'jobcards_fabric');
                const displayShort = shortLabel || label;
                const NavIcon = IconComponent || FileText;

                if (isSidebarCollapsed) {
                  return (
                    <button
                      key={tabKey}
                      type="button"
                      onClick={() => handleNavClick(tabKey)}
                      title={label}
                      style={{
                        background: isActive ? 'rgba(99,102,241,0.15)' : 'transparent',
                        border: 'none',
                        width: '100%',
                        padding: '0.55rem 0.2rem',
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: '3px',
                        borderRadius: '10px',
                        color: isActive ? 'var(--text-primary, #ffffff)' : 'var(--text-muted, #94a3b8)',
                        cursor: 'pointer',
                        textAlign: 'center',
                        transition: 'all 0.15s ease',
                        borderLeft: isActive ? '3.5px solid var(--primary, #6366f1)' : '3.5px solid transparent',
                        position: 'relative'
                      }}
                      onMouseEnter={e => {
                        if (!isActive) e.currentTarget.style.background = 'rgba(255,255,255,0.06)';
                      }}
                      onMouseLeave={e => {
                        if (!isActive) e.currentTarget.style.background = 'transparent';
                      }}
                    >
                      <NavIcon
                        size={22}
                        color={customColor || (isActive ? 'var(--primary)' : undefined)}
                        style={{ flexShrink: 0 }}
                      />
                      <span
                        style={{
                          fontSize: '0.67rem',
                          fontWeight: isActive ? 800 : 600,
                          lineHeight: 1.15,
                          color: isActive ? 'var(--primary, #6366f1)' : 'var(--text-muted, #94a3b8)',
                          wordBreak: 'break-word',
                          maxWidth: '72px',
                          textAlign: 'center'
                        }}
                      >
                        {displayShort}
                      </span>
                    </button>
                  );
                }

                return (
                  <button
                    key={tabKey}
                    type="button"
                    onClick={() => handleNavClick(tabKey)}
                    title={label}
                    style={{
                      background: isActive ? 'var(--nav-active-bg, rgba(99,102,241,0.12))' : 'none',
                      border: 'none',
                      width: '100%',
                      padding: '0.75rem 0.9rem',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'flex-start',
                      gap: '0.75rem',
                      borderRadius: 'var(--radius-sm, 8px)',
                      color: isActive ? 'var(--text-primary, #ffffff)' : 'var(--text-muted, #94a3b8)',
                      fontSize: '0.88rem',
                      fontWeight: isActive ? '700' : '500',
                      cursor: 'pointer',
                      textAlign: 'left',
                      transition: 'all 0.15s ease',
                      borderLeft: isActive ? '3px solid var(--nav-active-border, #6366f1)' : '3px solid transparent',
                      whiteSpace: 'nowrap',
                      overflow: 'hidden'
                    }}
                  >
                    <NavIcon size={18} color={customColor || (isActive ? 'var(--primary)' : undefined)} style={{ flexShrink: 0 }} />
                    <span style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>{label}</span>
                  </button>
                );
              };

              const renderSectionHeader = (label, IconComponent) => {
                const HeaderIcon = IconComponent || MessageSquare;
                return (
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: isSidebarCollapsed ? 'center' : 'flex-start',
                      gap: '0.45rem',
                      fontSize: '0.72rem',
                      fontWeight: '700',
                      textTransform: 'uppercase',
                      letterSpacing: '0.05em',
                      color: 'var(--text-muted)',
                      padding: isSidebarCollapsed ? '0.35rem 0' : '0.4rem 0.75rem',
                      borderBottom: '1px solid var(--border-light)',
                      marginBottom: '0.35rem'
                    }}
                    title={label}
                  >
                    <HeaderIcon size={15} color="var(--primary)" style={{ flexShrink: 0 }} />
                    {!isSidebarCollapsed && <span>{label}</span>}
                  </div>
                );
              };

              if (activeTab === 'workspace') {
                return (
                  <div style={{ padding: isSidebarCollapsed ? '0.4rem 0.2rem' : '0.75rem', background: 'rgba(255,255,255,0.03)', borderRadius: '8px', border: '1px solid var(--border-light)' }}>
                    {renderSectionHeader('Workspace', MessageSquare)}
                    {!isSidebarCollapsed && (
                      <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)', margin: '0.5rem 0 0', lineHeight: 1.4 }}>
                        Collaborate in real time, view task boards, and chat.
                      </p>
                    )}
                  </div>
                );
              }

              if (activeDepartment === 'elite_edition') {
                return (
                  <>
                    {renderSectionHeader('Elite Edition Modules', Building)}
                    {renderNavItem('ee_dashboard', 'Dashboard', LayoutDashboard, null, 'Dashboard')}
                    {renderNavItem('ee_invoices', 'Billing', Receipt, null, 'Billing')}
                    {renderNavItem('ee_complaints', 'Complaints', AlertTriangle, '#f43f5e', 'Complaints')}
                    {renderNavItem('ee_settings', 'Settings', Settings, null, 'Settings')}
                  </>
                );
              }

              if (activeDepartment === 'elite_fabtex') {
                return (
                  <>
                    {renderSectionHeader('Elite Fabtex Modules', Building)}
                    {renderNavItem('ef_dashboard', 'Dashboard', LayoutDashboard, null, 'Dashboard')}
                    {renderNavItem('ef_invoices', 'Billing', Receipt, null, 'Billing')}
                    {renderNavItem('ef_complaints', 'Complaints', AlertTriangle, '#f43f5e', 'Complaints')}
                    {renderNavItem('ef_settings', 'Settings', Settings, null, 'Settings')}
                  </>
                );
              }

              if (activeDepartment === 'stitching') {
                return (
                  <>
                    {renderSectionHeader('Elite Stitching Modules', Scissors)}
                    {renderNavItem('es_dashboard', 'Dashboard', LayoutDashboard, null, 'Dashboard')}
                    {(!currentUser || currentUser.role === 'admin' || currentUser.permissions?.includes('jobcards_list') || currentUser.permissions?.includes('stitching_jobcards')) &&
                      renderNavItem('jobcards_list', 'Jobcard', FileText, null, 'Jobcard')
                    }
                    {(!currentUser || currentUser.role === 'admin' || currentUser.permissions?.includes('jobcards_catalogue') || currentUser.permissions?.includes('stitching_design')) &&
                      renderNavItem('jobcards_catalogue', 'Design room', BookOpen, null, 'Design')
                    }
                    {(!currentUser || currentUser.role === 'admin' || currentUser.permissions?.includes('jobcards_fabric') || currentUser.permissions?.includes('jobcards_stitching_challan') || currentUser.permissions?.includes('stitching_fabric')) &&
                      renderNavItem('jobcards_stitching_challan', 'Challan', Database, null, 'Challan')
                    }
                    {renderNavItem('es_complaints', 'Complaints', AlertTriangle, '#f43f5e', 'Complaints')}
                    {(!currentUser || currentUser.role === 'admin' || currentUser.permissions?.includes('jobcards_stitching_settings') || currentUser.permissions?.includes('stitching_settings') || currentUser.permissions?.includes('es_settings')) &&
                      renderNavItem('es_settings', 'Settings', Settings, null, 'Settings')
                    }
                  </>
                );
              }

              if (activeDepartment === 'digital_print') {
                return (
                  <>
                    {renderSectionHeader('Digital Print Modules', Printer)}
                    {(!currentUser || currentUser.role === 'admin' || currentUser.permissions?.includes('jobcards')) &&
                      renderNavItem('jobcards', 'Prints Dashboard & Reports', BarChart3, null, 'Dashboard')
                    }
                    {(!currentUser || currentUser.role === 'admin' || currentUser.permissions?.includes('jobcards_printing_log')) &&
                      renderNavItem('jobcards_printing_log', 'Printing Department', Printer, null, 'Printing')
                    }
                    {(!currentUser || currentUser.role === 'admin' || currentUser.permissions?.includes('jobcards_fusing_log') || currentUser.permissions?.includes('jobcards')) &&
                      renderNavItem('jobcards_fusing_log', 'Fusing Department', Flame, null, 'Fusing')
                    }
                    {(!currentUser || currentUser.role === 'admin' || currentUser.permissions?.includes('jobcards_fabric')) &&
                      renderNavItem('jobcards_fabric', 'Fabric Management', Database, null, 'Fabric')
                    }
                    {(!currentUser || currentUser.role === 'admin' || currentUser.permissions?.includes('jobcards_billing')) &&
                      renderNavItem('jobcards_billing', 'Billing & Invoicing', Receipt, null, 'Billing')
                    }

                    {(!currentUser || currentUser.role === 'admin' || currentUser.permissions?.includes('jobcards_list')) &&
                      renderNavItem('jobcards_list', 'Job Card', FileText, null, 'Job Card')
                    }
                    {(!currentUser || currentUser.role === 'admin' || currentUser.permissions?.includes('jobcards_catalogue') || currentUser.permissions?.includes('jobcards_master')) &&
                      renderNavItem('jobcards_catalogue', 'Design Catalog', BookOpen, null, 'Catalog')
                    }
                    {(!currentUser || currentUser.role === 'admin' || currentUser.permissions?.includes('jobcards_settings')) &&
                      renderNavItem('jobcards_settings', 'Print Settings', Settings, null, 'Settings')
                    }
                    {(!currentUser || currentUser.role === 'admin' || currentUser.permissions?.includes('jobcards_raw_materials')) &&
                      renderNavItem('jobcards_raw_materials', 'Raw Materials', ShoppingBag, null, 'Materials')
                    }
                    {(!currentUser || currentUser.role === 'admin' || currentUser.permissions?.includes('jobcards_complain') || currentUser.permissions?.includes('jobcards_complaints') || currentUser.permissions?.includes('complaint_dashboard') || currentUser.permissions?.includes('complaint_create')) &&
                      renderNavItem('jobcards_complain', 'Complain Module', AlertTriangle, '#f43f5e', 'Complain')
                    }
                  </>
                );
              }

              return (
                <>
                  {renderSectionHeader('Elite Online Modules', Store)}
                  {(!currentUser || currentUser.role === 'admin' || currentUser.permissions?.includes('dashboard')) &&
                    renderNavItem('dashboard', 'Dashboard Overview', LayoutDashboard, null, 'Dashboard')
                  }
                  {(!currentUser || currentUser.role === 'admin' || currentUser.permissions?.includes('inventory')) &&
                    renderNavItem('inventory', 'Store Inventory', Database, null, 'Inventory')
                  }
                  {(!currentUser || currentUser.role === 'admin' || currentUser.permissions?.includes('catalog')) &&
                    renderNavItem('catalog', 'Product Catalog', BookOpen, null, 'Products')
                  }
                  {(!currentUser || currentUser.role === 'admin' || currentUser.permissions?.includes('returns')) &&
                    renderNavItem('returns', 'Returns Department', PackageMinus, null, 'Returns')
                  }
                  {(!currentUser || currentUser.role === 'admin' || currentUser.permissions?.includes('sales')) &&
                    renderNavItem('sales', 'Sales Orders', ShoppingBag, null, 'Sales')
                  }
                  {renderNavItem('eo_complaints', 'Complaints', AlertTriangle, '#f43f5e', 'Complaints')}
                  {(!currentUser || currentUser.role === 'admin' || currentUser.permissions?.includes('reports')) &&
                    renderNavItem('reports', 'Reports Center', BarChart3, null, 'Reports')
                  }
                  {(!currentUser || currentUser.role === 'admin' || currentUser.permissions?.includes('unicommerce')) &&
                    renderNavItem('unicommerce', 'Uniware Integrations', RefreshCw, null, 'Uniware')
                  }
                  {(!currentUser || currentUser.role === 'admin' || currentUser.permissions?.includes('myntra')) &&
                    renderNavItem('myntra', 'Myntra Integrations', ShoppingBag, null, 'Myntra')
                  }
                </>
              );
            })()}

            {currentUser && currentUser.role === 'admin' && (
              isSidebarCollapsed ? (
                <button
                  type="button"
                  onClick={() => handleNavClick('admin')}
                  title="Admin Panel"
                  style={{
                    background: activeTab === 'admin' ? 'rgba(99,102,241,0.15)' : 'transparent',
                    border: 'none',
                    width: '100%',
                    padding: '0.55rem 0.2rem',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '3px',
                    borderRadius: '10px',
                    color: activeTab === 'admin' ? 'var(--text-primary, #ffffff)' : 'var(--text-muted, #94a3b8)',
                    cursor: 'pointer',
                    textAlign: 'center',
                    transition: 'all 0.15s ease',
                    borderLeft: activeTab === 'admin' ? '3.5px solid var(--primary, #6366f1)' : '3.5px solid transparent',
                    borderTop: '1px solid var(--border-light)',
                    marginTop: '0.5rem',
                    paddingTop: '0.65rem'
                  }}
                >
                  <ShieldAlert size={22} color="var(--primary)" style={{ flexShrink: 0 }} />
                  <span style={{ fontSize: '0.67rem', fontWeight: activeTab === 'admin' ? 800 : 600, color: activeTab === 'admin' ? 'var(--primary)' : 'var(--text-muted)' }}>
                    Admin
                  </span>
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => handleNavClick('admin')}
                  title="Admin Panel"
                  style={{
                    background: activeTab === 'admin' ? 'var(--nav-active-bg, rgba(99,102,241,0.12))' : 'none',
                    border: 'none',
                    width: '100%',
                    padding: '0.75rem 0.9rem',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'flex-start',
                    gap: '0.75rem',
                    borderRadius: 'var(--radius-sm, 8px)',
                    color: activeTab === 'admin' ? 'var(--text-primary, #ffffff)' : 'var(--text-muted, #94a3b8)',
                    fontSize: '0.88rem',
                    fontWeight: activeTab === 'admin' ? '700' : '500',
                    cursor: 'pointer',
                    textAlign: 'left',
                    transition: 'all 0.15s ease',
                    borderLeft: activeTab === 'admin' ? '3px solid var(--nav-active-border, #6366f1)' : '3px solid transparent',
                    borderTop: '1px solid var(--border-light)',
                    marginTop: '0.5rem',
                    paddingTop: '0.75rem',
                    whiteSpace: 'nowrap',
                    overflow: 'hidden'
                  }}
                >
                  <ShieldAlert size={18} color="var(--primary)" style={{ flexShrink: 0 }} />
                  <span>Admin Panel</span>
                </button>
              )
            )}

          </div>
        </aside>

        {/* Right Content Panel */}
        <section style={styles.contentArea}>
          {error && <div style={styles.globalError}>{error}</div>}

          <Suspense fallback={
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '300px', gap: '1rem', color: 'var(--text-muted)' }}>
              <RefreshCw size={28} className="spin-loader" color="var(--primary)" />
              <span style={{ fontSize: '0.88rem', fontWeight: 600 }}>Loading module...</span>
            </div>
          }>

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
            <JobCardPanel currentUser={currentUser} activeSubTab={activeTab === 'jobcards' ? 'jobcards' : activeTab.replace('jobcards_', '')} department={activeDepartment} />
          ) : activeTab === 'ee_dashboard' ? (
            <CompanyDedicatedDashboard companyEntity="Elite Edition" onNavigate={(tab) => setActiveTab(tab)} />
          ) : activeTab === 'ee_settings' ? (
            <CompanySettingsPanel companyEntity="Elite Edition" />
          ) : activeTab === 'ee_complaints' ? (
            <DigitalPrintComplainModule companyEntity="Elite Edition" />
          ) : activeTab === 'ee_invoices' ? (
            <EliteBillingDepartment companyEntity="Elite Edition" />
          ) : activeTab === 'ef_dashboard' ? (
            <CompanyDedicatedDashboard companyEntity="Elite Fabtex" onNavigate={(tab) => setActiveTab(tab)} />
          ) : activeTab === 'ef_settings' ? (
            <CompanySettingsPanel companyEntity="Elite Fabtex" />
          ) : activeTab === 'ef_complaints' ? (
            <DigitalPrintComplainModule companyEntity="Elite Fabtex" />
          ) : activeTab === 'ef_invoices' ? (
            <EliteBillingDepartment companyEntity="Elite Fabtex" />
          ) : activeTab === 'es_dashboard' ? (
            <GarmentJobCardDashboard />
          ) : activeTab === 'es_settings' || activeTab === 'jobcards_stitching_settings' ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
              <CompanySettingsPanel companyEntity="Elite Stitching" />
              <StitchingSettings />
            </div>
          ) : activeTab === 'es_complaints' ? (
            <DigitalPrintComplainModule companyEntity="Elite Stitching" />
          ) : activeTab === 'eo_complaints' ? (
            <DigitalPrintComplainModule companyEntity="Elite Online" />
          ) : activeDepartment === 'elite_edition' ? (
            <CompanyDedicatedDashboard companyEntity="Elite Edition" onNavigate={(tab) => setActiveTab(tab)} />
          ) : activeDepartment === 'elite_fabtex' ? (
            <CompanyDedicatedDashboard companyEntity="Elite Fabtex" onNavigate={(tab) => setActiveTab(tab)} />
          ) : activeDepartment === 'stitching' ? (
            <GarmentJobCardDashboard />
          ) : activeTab === 'unicommerce' ? (
            <UnicommerceHub />
          ) : activeTab === 'myntra' ? (
            <MyntraHub />
          ) : activeTab === 'communication' ? (
            <CommunicationPanel currentUser={currentUser} onNavigateTab={(tab) => setActiveTab(tab)} />
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
          </Suspense>

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
    position: 'sticky',
    top: 0,
    zIndex: 1000,
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '0.4rem 1rem',
    flexWrap: 'wrap',
    gap: '0.75rem',
    backdropFilter: 'blur(16px)',
    WebkitBackdropFilter: 'blur(16px)',
    borderBottom: '1px solid var(--border-light)',
    backgroundColor: 'var(--bg-card, #ffffff)',
    minHeight: '52px',
    boxShadow: '0 2px 12px rgba(0, 0, 0, 0.04)'
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
