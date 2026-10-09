import React, { useState, useEffect, useRef, lazy, Suspense } from 'react';
import ReactDOM from 'react-dom';
import { api, getBaseUrl, setBaseUrl } from './services/api';
import Login from './components/Login';

// Dynamic code-splitting for all route and workspace modules
const ClientLogin = lazy(() => import('./components/ClientLogin'));
const ClientPortal = lazy(() => import('./components/ClientPortal'));
const DashboardStats = lazy(() => import('./components/DashboardStats'));
const InventoryGrid = lazy(() => import('./components/InventoryGrid'));
const ProductCatalogGrid = lazy(() => import('./components/ProductCatalogGrid'));
const InventoryForm = lazy(() => import('./components/InventoryForm'));
const BulkInwardModal = lazy(() => import('./components/BulkInwardModal'));
const SalesGrid = lazy(() => import('./components/SalesGrid'));
const StockOutForm = lazy(() => import('./components/StockOutForm'));
const CatalogManagerModal = lazy(() => import('./components/CatalogManagerModal'));
const JobCardPanel = lazy(() => import('./components/JobCardPanel'));
const StitchingSettings = lazy(() => import('./components/StitchingSettings'));
const AdminPanel = lazy(() => import('./components/AdminPanel'));
const Workspace = lazy(() => import('./components/Workspace'));
const CommunicationPanel = lazy(() => import('./components/CommunicationPanel'));
const TaskManagerPanel = lazy(() => import('./components/TaskManagerPanel'));
const CompanySettingsPanel = lazy(() => import('./components/CompanySettingsPanel'));
const EliteBillingDepartment = lazy(() => import('./components/EliteBillingDepartment'));
const CompanyDevelopmentWorkspace = lazy(() => import('./components/CompanyDevelopmentWorkspace'));
const DigitalPrintComplainModule = lazy(() => import('./components/DigitalPrintComplainModule'));
const DigitalPrintExpenseModule = lazy(() => import('./components/DigitalPrintExpenseModule'));
const CompanyDedicatedDashboard = lazy(() => import('./components/CompanyDedicatedDashboard'));
const GarmentJobCardDashboard = lazy(() => import('./components/GarmentJobCardDashboard'));
const CrmPanel = lazy(() => import('./components/CrmPanel'));
const BusinessConnectionPanel = lazy(() => import('./components/BusinessConnectionPanel'));
const ReportsCenter = lazy(() => import('./components/ReportsCenter'));
const UnicommerceHub = lazy(() => import('./components/UnicommerceHub'));
const MyntraHub = lazy(() => import('./components/MyntraHub'));
const ReturnsManager = lazy(() => import('./components/ReturnsManager'));
const DesignerModule = lazy(() => import('./components/DesignerModule'));
const DesignerScreen = lazy(() => import('./components/DesignerScreen'));

import EliteModalDialog from './components/EliteModalDialog';
import { triggerEliteAlert, triggerEliteConfirm } from './services/dialogService';
import PdfPreviewModal from './components/PdfPreviewModal';
import PrintOptionsModal from './components/PrintOptionsModal';
import AutoUpdateNotification from './components/AutoUpdateNotification';
import { webPushClient } from './services/webPushClient';
import { matchSkuOrBrandCode } from './utils/skuHelper';
import { COMPANIES, getCompanyById } from './config/companiesConfig';
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
  ShieldCheck,
  Flame,
  Menu,
  X,
  Bell,
  BellRing,
  Users,
  Scissors,
  Building,
  Receipt,
  TrendingUp,
  PanelLeftClose,
  PanelLeftOpen,
  Clock,
  Sparkles,
  Sliders,
  Bot,
  Phone,
  PhoneOff,
  Search,
  MoreHorizontal,
  CheckSquare
} from 'lucide-react';

import NotificationToastContainer, { triggerPushNotification, triggerGlobalDataRefresh, requestNotificationPermission, NotificationHistoryDrawer, getNotificationHistory } from './components/NotificationToast';
import WebDevicePermissionsModal from './components/WebDevicePermissionsModal';
import PermissionHelpModal from './components/PermissionHelpModal';
import { useSocket } from './contexts/SocketContext';
import { socketManager } from './services/socketManager';
import GlobalSearchModal from './components/common/GlobalSearchModal';
import AIMeasurementAgentModal from './components/common/AIMeasurementAgentModal';
import MobileBottomNav from './components/common/MobileBottomNav';
import UndoToastContainer from './components/common/UndoToast';
import ErrorBoundary from './components/common/ErrorBoundary';
import OfflineBanner from './components/common/OfflineBanner';
import PullToRefresh from './components/common/PullToRefresh';
import { DashboardSkeleton } from './components/common/Skeleton';
import BarcodeSnifferHUD from './components/common/BarcodeSnifferHUD';
import { ZenFocusModeController } from './components/common/ZenFocusModeController';
import { TableContextMenu } from './components/common/TableContextMenu';
import { KeyboardShortcutModal } from './components/common/KeyboardShortcutModal';
import { StickyScrollShadowTracker } from './components/common/StickyScrollShadowTracker';
import { EnterpriseHUDThemeController } from './components/common/EnterpriseHUDThemeController';
import { ChangelogDrawer } from './components/common/ChangelogDrawer';
import { QuickTipPill } from './components/common/QuickTipPill';
import { GuidedTourController } from './components/common/GuidedTourController';



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
        savedDept = localStorage.getItem('elite_active_dept') || localStorage.getItem('elite_active_department') || '';
      }
    } catch (e) {}

    return {
      tab: savedTab || 'jobcards',
      dept: savedDept || 'digital_print'
    };
  };

  const initialNav = getSavedNavState();
  const socket = useSocket();
  const [connectionStatus, setConnectionStatus] = useState(() => socketManager.getStatus());
  const [conflictRecord, setConflictRecord] = useState(null);
  const [isAuthenticated, setIsAuthenticated] = useState(api.isAuthenticated());
  const [currentUser, setCurrentUser] = useState(() => api.getCurrentUser());

  useEffect(() => {
    return socketManager.onStatusChange((newStatus) => {
      setConnectionStatus(newStatus);
    });
  }, []);

  const checkIsClientUrl = () => {
    try {
      if (typeof window === 'undefined') return false;
      const hash = (window.location.hash || '').toLowerCase();
      const path = (window.location.pathname || '').toLowerCase();
      const search = new URLSearchParams(window.location.search || '');
      return (
        hash === '#client-login' ||
        hash === '#client' ||
        hash === '#/client-login' ||
        hash === '#/client' ||
        path.startsWith('/client') ||
        search.get('portal') === 'client' ||
        search.get('client') === 'true'
      );
    } catch (e) {
      return false;
    }
  };

  const [isClientPortalMode, setIsClientPortalMode] = useState(() => checkIsClientUrl() || api.isClientUser());

  useEffect(() => {
    const handleUrlChange = () => {
      const isClient = checkIsClientUrl();
      if (isClient || api.isClientUser()) {
        setIsClientPortalMode(true);
      } else {
        setIsClientPortalMode(false);
      }
    };
    window.addEventListener('hashchange', handleUrlChange);
    window.addEventListener('popstate', handleUrlChange);
    return () => {
      window.removeEventListener('hashchange', handleUrlChange);
      window.removeEventListener('popstate', handleUrlChange);
    };
  }, []);

  // Handle QR code scan redirect to public Job Card viewer
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const search = new URLSearchParams(window.location.search || '');
    const hash = window.location.hash || '';
    let jcId = search.get('id') || search.get('jobNo') || search.get('jobcard');
    if (!jcId && (hash.startsWith('#jobcard_') || hash.startsWith('#jc_'))) {
      jcId = hash.replace(/^#(jobcard_|jc_)/, '').split('?')[0];
    }
    if ((search.get('view') === 'jobcard' || hash.includes('jobcard_view')) && jcId) {
      window.location.replace(`/verify/jobcard/${encodeURIComponent(jcId)}`);
    }
  }, []);

  const [activeTab, setActiveTab] = useState(initialNav.tab);
  const [items, setItems] = useState([]);
  const [catalogItems, setCatalogItems] = useState([]);
  const [sales, setSales] = useState([]);
  const [parties, setParties] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // Notification Toasts state
  const [toasts, setToasts] = useState([]);
  const [globalIncomingCall, setGlobalIncomingCall] = useState(null);
  const [showPermHelpModal, setShowPermHelpModal] = useState(false);
  const [permSnoozedSession, setPermSnoozedSession] = useState(() => {
    try {
      return sessionStorage.getItem('elite_perm_snoozed_session') === 'true';
    } catch {
      return false;
    }
  });

  // Chat unread count tracking for notification badges
  const [chatUnreadCount, setChatUnreadCount] = useState(0);

  // Global AI Measurement Agent modal state
  const [globalAiMeasurement, setGlobalAiMeasurement] = useState({ isOpen: false, initialData: {}, onApply: null });

  useEffect(() => {
    const handleOpenAi = (e) => {
      const { initialData = {}, onApply = null } = e?.detail || {};
      setGlobalAiMeasurement({ isOpen: true, initialData, onApply });
    };
    window.addEventListener('open-ai-measurement', handleOpenAi);
    return () => window.removeEventListener('open-ai-measurement', handleOpenAi);
  }, []);

  useEffect(() => {
    if (!isAuthenticated) return;
    api.getCommunicationGroups()
      .then((res) => {
        const groupsList = res?.data || (Array.isArray(res) ? res : []);
        const total = groupsList.reduce((acc, g) => acc + (Number(g.unreadCount) || 0), 0);
        setChatUnreadCount(total);
      })
      .catch(() => {});
  }, [isAuthenticated]);

  useEffect(() => {
    const handleUnreadEvent = (e) => {
      if (e.detail && typeof e.detail.count === 'number') {
        setChatUnreadCount(e.detail.count);
      }
    };
    window.addEventListener('chat-unread-count-change', handleUnreadEvent);
    return () => window.removeEventListener('chat-unread-count-change', handleUnreadEvent);
  }, []);

  // Listen for broadcast session expiration (silent refresh failure / 401 unrecoverable)
  useEffect(() => {
    const handleExpired = () => {
      socketManager.disconnect();
      api.logout();
      setIsAuthenticated(false);
      setCurrentUser(null);
      setItems([]);
      setCatalogItems([]);
      setSales([]);
      setParties([]);
      try {
        if ('caches' in window) {
          caches.keys().then((keys) => {
            keys.forEach((key) => {
              if (key.includes('runtime') || key.includes('user') || key.includes('api')) {
                caches.delete(key);
              }
            });
          });
        }
        sessionStorage.clear();
      } catch (e) {}
    };
    window.addEventListener('elite-session-expired', handleExpired);
    return () => window.removeEventListener('elite-session-expired', handleExpired);
  }, []);

  // Department state (digital_print vs elite_edition vs stitching)
  const [activeDepartment, setActiveDepartment] = useState(initialNav.dept);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [showCompanyQuickSheet, setShowCompanyQuickSheet] = useState(false);
  const [isMobile, setIsMobile] = useState(() => typeof window !== 'undefined' && window.innerWidth < 768);
  const [showGlobalSearch, setShowGlobalSearch] = useState(false);

  // Global Ctrl/Cmd + K shortcut for Global Search
  useEffect(() => {
    const handleKeyDown = (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setShowGlobalSearch((prev) => !prev);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Global Alt + E shortcut for Company Switcher
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.altKey && e.key.toLowerCase() === 'e') {
        e.preventDefault();
        setShowCompanyQuickSheet((prev) => !prev);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Dynamically bind Multi-Entity Visual Accents to document :root
  useEffect(() => {
    const comp = getCompanyById(activeDepartment);
    if (!comp || typeof document === 'undefined') return;
    const root = document.documentElement;
    const color = comp.badgeColor || comp.iconColor || '#2563eb';
    const hex = color.replace('#', '');
    const r = parseInt(hex.substring(0, 2), 16) || 37;
    const g = parseInt(hex.substring(2, 4), 16) || 99;
    const b = parseInt(hex.substring(4, 6), 16) || 235;

    root.style.setProperty('--entity-accent', color);
    root.style.setProperty('--entity-accent-rgb', `${r}, ${g}, ${b}`);
    root.style.setProperty('--entity-gradient', comp.gradient || `linear-gradient(135deg, ${color}, #1d4ed8)`);
    root.style.setProperty('--entity-code', comp.code);
    root.style.setProperty('--entity-name', comp.name);
  }, [activeDepartment]);

  // Global listener for opening search from Barcode Sniffer HUD or external actions
  useEffect(() => {
    const handleOpenSearchEvent = () => {
      setShowGlobalSearch(true);
    };
    window.addEventListener('elite:open-global-search', handleOpenSearchEvent);
    return () => window.removeEventListener('elite:open-global-search', handleOpenSearchEvent);
  }, []);

  const handleSelectSearchResult = (item) => {
    if (!item) return;

    if (item.action === 'new_jobcard') {
      setActiveTab('jobcards');
      setTimeout(() => {
        window.dispatchEvent(new CustomEvent('elite-create-job-card'));
      }, 100);
    } else if (item.action === 'new_inward') {
      setIsBulkInwardOpen(true);
    } else if (item.action === 'view_stock') {
      if (activeDepartment === 'digital_print') {
        setActiveTab('fabric_inventory');
      } else {
        setActiveTab('inventory');
      }
    } else if (item.action === 'new_invoice') {
      if (activeDepartment === 'digital_print') {
        setActiveTab('billing');
      } else {
        setActiveTab('ee_invoices');
      }
    } else if (item.action === 'stitching_challan') {
      setActiveTab('stitching_challan');
    } else if (item.action === 'refresh_data') {
      fetchData();
      triggerGlobalDataRefresh();
      if (typeof window !== 'undefined' && window.showToast) {
        window.showToast('Data refreshed successfully', 'success');
      }
    } else if (item.action === 'nav_approvals') {
      setActiveTab('admin');
      setTimeout(() => {
        window.dispatchEvent(new CustomEvent('elite-switch-admin-tab', { detail: { tab: 'approvals' } }));
      }, 100);
    } else if (item.action === 'nav_backup') {
      setActiveTab('admin');
      setTimeout(() => {
        window.dispatchEvent(new CustomEvent('elite-switch-admin-tab', { detail: { tab: 'backup' } }));
      }, 100);
    } else if (item.tab) {
      setActiveTab(item.tab);
    } else if (item.type === 'jobcard') {
      setActiveTab('jobcards');
    } else if (item.type === 'invoice') {
      setActiveTab('ee_invoices');
    } else if (item.type === 'party') {
      setActiveTab('jobcards_crm');
    } else if (item.type === 'inventory') {
      setActiveTab('inventory');
    } else if (item.route) {
      window.location.hash = item.route;
    }
  };

  // PWA & Native App State Management
  const [deferredInstallPrompt, setDeferredInstallPrompt] = useState(null);
  const [isStandalone, setIsStandalone] = useState(() => {
    if (typeof window === 'undefined') return false;
    return window.matchMedia('(display-mode: standalone)').matches || Boolean(window.navigator.standalone);
  });
  const [showIosInstallHint, setShowIosInstallHint] = useState(() => {
    if (typeof window === 'undefined') return false;
    const isIos = /iPad|iPhone|iPod/.test(navigator.userAgent) && !window.MSStream;
    const isSafari = /Safari/.test(navigator.userAgent) && !/CriOS|FxiOS/.test(navigator.userAgent);
    const standalone = window.matchMedia('(display-mode: standalone)').matches || Boolean(window.navigator.standalone);
    const dismissed = localStorage.getItem('dismissed_ios_install_hint');
    return isIos && isSafari && !standalone && !dismissed;
  });
  const [isOnline, setIsOnline] = useState(() => (typeof navigator !== 'undefined' ? navigator.onLine : true));
  const [updateWaitingWorker, setUpdateWaitingWorker] = useState(null);

  // Capture beforeinstallprompt and appinstalled
  useEffect(() => {
    const handleBeforeInstall = (e) => {
      e.preventDefault();
      setDeferredInstallPrompt(e);
    };
    const handleAppInstalled = () => {
      setDeferredInstallPrompt(null);
      setIsStandalone(true);
    };
    window.addEventListener('beforeinstallprompt', handleBeforeInstall);
    window.addEventListener('appinstalled', handleAppInstalled);
    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstall);
      window.removeEventListener('appinstalled', handleAppInstalled);
    };
  }, []);

  // Monitor Network Connectivity (Offline status)
  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  // Monitor Service Worker Updates
  useEffect(() => {
    const handlePwaUpdate = (e) => {
      const reg = e.detail?.registration;
      if (reg && reg.waiting) {
        setUpdateWaitingWorker(reg.waiting);
      }
    };
    window.addEventListener('pwa-update-available', handlePwaUpdate);
    return () => window.removeEventListener('pwa-update-available', handlePwaUpdate);
  }, []);

  // Back button / gesture navigation handling: close drawer or modals before exit
  useEffect(() => {
    const handlePopState = () => {
      if (mobileMenuOpen) {
        setMobileMenuOpen(false);
      } else if (showCompanyQuickSheet) {
        setShowCompanyQuickSheet(false);
      }
    };
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, [mobileMenuOpen, showCompanyQuickSheet]);

  // Keep navigation in app scope: external links open in browser
  useEffect(() => {
    const handleExternalLinks = (e) => {
      const anchor = e.target.closest('a');
      if (anchor && anchor.href) {
        try {
          const url = new URL(anchor.href, window.location.origin);
          if (url.origin !== window.location.origin) {
            anchor.target = '_blank';
            anchor.rel = 'noopener noreferrer';
          }
        } catch (err) {}
      }
    };
    document.addEventListener('click', handleExternalLinks);
    return () => document.removeEventListener('click', handleExternalLinks);
  }, []);

  const handleInstallClick = async () => {
    if (!deferredInstallPrompt) return;
    deferredInstallPrompt.prompt();
    const { outcome } = await deferredInstallPrompt.userChoice;
    if (outcome === 'accepted') {
      setDeferredInstallPrompt(null);
    }
  };

  const handleApplyUpdate = () => {
    if (updateWaitingWorker) {
      updateWaitingWorker.postMessage({ type: 'SKIP_WAITING' });
    } else {
      window.location.reload();
    }
  };

  // Lock body scroll when mobile drawer or company quick sheet is open
  useEffect(() => {
    if (mobileMenuOpen || showCompanyQuickSheet) {
      document.body.classList.add('body-scroll-lock');
    } else {
      document.body.classList.remove('body-scroll-lock');
    }
    return () => {
      document.body.classList.remove('body-scroll-lock');
    };
  }, [mobileMenuOpen, showCompanyQuickSheet]);

  const handleMenuButtonClick = (e) => {
    if (e && e.preventDefault) e.preventDefault();
    setMobileMenuOpen(prev => !prev);
  };

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
      localStorage.setItem('elite_active_department', activeDepartment);
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
    if (saved !== null) return saved === 'true';
    return typeof window !== 'undefined' ? window.innerWidth < 1024 : false;
  });
  const [mobileHeaderMoreOpen, setMobileHeaderMoreOpen] = useState(false);

  const toggleSidebarCollapse = () => {
    setIsSidebarCollapsed(prev => {
      const next = !prev;
      localStorage.setItem('sidebar_collapsed', String(next));
      return next;
    });
  };

  // Department permission helpers
  const ELITE_ONLINE_PERMISSIONS = ['dashboard', 'elite_online', 'inventory', 'catalog', 'returns', 'sales', 'reports', 'unicommerce', 'myntra', 'eo_complaints', 'eo_expenses', 'eo_settings'];
  const ELITE_EDITION_PERMISSIONS = ['ee_dashboard', 'ee_invoices', 'ee_complaints', 'ee_settings', 'ee_expenses'];
  const ELITE_FABTEX_PERMISSIONS = ['ef_dashboard', 'ef_invoices', 'ef_complaints', 'ef_settings', 'ef_expenses'];
  const EDP_PERMISSIONS = ['jobcards', 'jobcards_status_dashboard', 'jobcards_status', 'jobcards_printing_log', 'jobcards_fabric', 'jobcards_billing', 'jobcards_costing', 'jobcards_engine', 'jobcards_list', 'jobcards_tracking', 'jobcards_catalogue', 'jobcards_sample', 'jobcards_master', 'designer_screen', 'designer_module', 'jobcards_settings', 'jobcards_raw_materials', 'jobcards_complain', 'jobcards_complaints', 'complaint_dashboard', 'complaint_create', 'jobcards_expense', 'jobcards_expenses', 'expense_dashboard', 'expense_create', 'jobcards_crm', 'crm_department', 'crm', 'crm_profiles', 'crm_leads', 'jobcards_master_ai', 'master_ai_agent', 'jobcards_business_connection', 'business_connection'];
  const STITCHING_PERMISSIONS = [
    'es_dashboard', 'stitching_jobcards', 'stitching_design', 'stitching_fabric', 'stitching_settings',
    'jobcards_stitching_challan', 'jobcards_stitching_settings', 'stitching', 'es_complaints', 'es_expenses'
  ];

  const isSuperOrAdmin = Boolean(
    currentUser?.role === 'admin' || 
    currentUser?.role === 'main_admin' || 
    currentUser?.isMainAdmin || 
    currentUser?.isAdmin === true || 
    currentUser?.email === 'harshitsidapara2468@gmail.com'
  );

  const isCompanyAllowed = (companyNameOrId) => {
    if (!currentUser) return false;
    if (isSuperOrAdmin) return true;
    if (Array.isArray(currentUser.allowedCompanies)) {
      if (currentUser.allowedCompanies.length === 0) return false;
      const target = String(companyNameOrId || '').toLowerCase().trim();
      // Match EON / Elite Online
      if (target === 'eon' || target === 'elite online' || target === 'elite_online') {
        return currentUser.allowedCompanies.some(c => {
          const l = String(c).toLowerCase().trim();
          return l === 'eon' || l === 'elite online' || l === 'elite_online';
        });
      }
      // Match EDP / Elite Digital Print / Elite Digital Prints
      if (target === 'edp' || target === 'elite digital print' || target === 'elite digital prints' || target === 'digital_print' || target === 'digital_prints') {
        return currentUser.allowedCompanies.some(c => {
          const l = String(c).toLowerCase().trim();
          return l === 'edp' || l === 'elite digital print' || l === 'elite digital prints' || l === 'digital_print' || l === 'digital_prints';
        });
      }
      // Match ES / Elite Stitching
      if (target === 'es' || target === 'elite stitching' || target === 'stitching') {
        return currentUser.allowedCompanies.some(c => {
          const l = String(c).toLowerCase().trim();
          return l === 'es' || l === 'elite stitching' || l === 'stitching';
        });
      }
      // Match EE / Elite Edition
      if (target === 'ee' || target === 'elite edition' || target === 'elite_edition') {
        return currentUser.allowedCompanies.some(c => {
          const l = String(c).toLowerCase().trim();
          return l === 'ee' || l === 'elite edition' || l === 'elite_edition';
        });
      }
      // Match EF / Elite Fabtex
      if (target === 'ef' || target === 'elite fabtex' || target === 'elite_fabtex') {
        return currentUser.allowedCompanies.some(c => {
          const l = String(c).toLowerCase().trim();
          return l === 'ef' || l === 'elite fabtex' || l === 'elite_fabtex';
        });
      }
      return currentUser.allowedCompanies.some(c => String(c).toLowerCase().trim() === target);
    }
    return false;
  };

  const hasEliteOnlineAccess = isSuperOrAdmin || isCompanyAllowed('elite_online');
  const hasDigitalPrintAccess = isSuperOrAdmin || isCompanyAllowed('digital_print');
  const hasStitchingAccess = isSuperOrAdmin || isCompanyAllowed('stitching');
  const hasEliteEditionAccess = isSuperOrAdmin || isCompanyAllowed('elite_edition');
  const hasEliteFabtexAccess = isSuperOrAdmin || isCompanyAllowed('elite_fabtex');

  const hasCommunicationAccess = !currentUser || isSuperOrAdmin || 
    Boolean(currentUser?.canBroadcastChat) || 
    Boolean(currentUser?.permissions?.some(p => ['workspace', 'communication', 'interdept-communication', 'chat'].includes(p)));

  const hasTaskAccess = !currentUser || isSuperOrAdmin || 
    Boolean(currentUser?.canManageTasks) || 
    Boolean(currentUser?.permissions?.some(p => ['task_management', 'task-manager', 'tasks', 'task'].includes(p)));

  const hasWorkspaceAccess = hasCommunicationAccess || hasTaskAccess;

  const getFirstJobCardsTab = () => {
    if (!currentUser || isSuperOrAdmin) return 'jobcards';
    const subTabs = ['jobcards', 'jobcards_sample', 'jobcards_printing_log', 'jobcards_fabric', 'jobcards_billing', 'jobcards_engine', 'jobcards_list', 'jobcards_tracking', 'jobcards_catalogue', 'jobcards_master', 'jobcards_settings', 'jobcards_raw_materials'];
    const allowed = subTabs.filter(t => currentUser.permissions?.includes(t));
    return allowed[0] || 'jobcards';
  };

  const getFirstOnlineTab = () => {
    if (!currentUser || isSuperOrAdmin) return 'dashboard';
    const allowed = ELITE_ONLINE_PERMISSIONS.filter(t => currentUser.permissions?.includes(t));
    return allowed[0] || 'dashboard';
  };

  const getFirstEETab = () => {
    if (!currentUser || isSuperOrAdmin) return 'ee_dashboard';
    const allowed = ELITE_EDITION_PERMISSIONS.filter(t => currentUser.permissions?.includes(t));
    return allowed[0] || 'ee_dashboard';
  };

  const getFirstEFTab = () => {
    if (!currentUser || isSuperOrAdmin) return 'ef_dashboard';
    const allowed = ELITE_FABTEX_PERMISSIONS.filter(t => currentUser.permissions?.includes(t));
    return allowed[0] || 'ef_dashboard';
  };

  const getFirstStitchingTab = () => {
    if (!currentUser || isSuperOrAdmin) return 'jobcards_list';
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
    if (activeTab.startsWith('jobcards') || activeTab === 'business_connection' || activeTab === 'crm' || activeTab === 'master_ai_agent') {
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

  // Auto-switch department if user lacks permission for current activeDepartment
  useEffect(() => {
    if (!currentUser || isSuperOrAdmin) return;
    const allowedDepts = [];
    if (isCompanyAllowed('elite_online') && hasEliteOnlineAccess) allowedDepts.push('elite_online');
    if (isCompanyAllowed('digital_print') && hasDigitalPrintAccess) allowedDepts.push('digital_print');
    if (isCompanyAllowed('stitching') && hasStitchingAccess) allowedDepts.push('stitching');
    if (isCompanyAllowed('elite_edition') && hasEliteEditionAccess) allowedDepts.push('elite_edition');
    if (isCompanyAllowed('elite_fabtex') && hasEliteFabtexAccess) allowedDepts.push('elite_fabtex');

    if (allowedDepts.length > 0) {
      if (!allowedDepts.includes(activeDepartment)) {
        const targetDept = allowedDepts[0];
        setActiveDepartment(targetDept);
        if (!['communication', 'workspace', 'task_management'].includes(activeTab)) {
          if (targetDept === 'stitching') setActiveTab(getFirstStitchingTab());
          else if (targetDept === 'digital_print') setActiveTab(getFirstJobCardsTab());
          else if (targetDept === 'elite_edition') setActiveTab(getFirstEETab());
          else if (targetDept === 'elite_fabtex') setActiveTab(getFirstEFTab());
          else if (targetDept === 'elite_online') setActiveTab(getFirstOnlineTab());
        }
      }
    } else {
      if (!['communication', 'workspace', 'task_management'].includes(activeTab)) {
        if (hasCommunicationAccess) {
          setActiveTab('communication');
        } else if (hasTaskAccess) {
          setActiveTab('task_management');
        } else {
          setActiveTab('no-access');
        }
      }
    }
  }, [currentUser?.role, JSON.stringify(currentUser?.permissions || []), JSON.stringify(currentUser?.allowedCompanies || []), activeDepartment, hasEliteOnlineAccess, hasDigitalPrintAccess, hasStitchingAccess, hasEliteEditionAccess, hasEliteFabtexAccess, hasCommunicationAccess, hasTaskAccess, isSuperOrAdmin]);

  const handleNavClick = (tab) => {
    setActiveTab(tab);
    setMobileMenuOpen(false);
  };

  const handleSwitchDepartment = (dept) => {
    setActiveDepartment(dept);
    try {
      localStorage.setItem('elite_active_dept', dept);
      localStorage.setItem('elite_active_department', dept);
    } catch (e) {}
    const comp = getCompanyById(dept);
    socketManager.setCompany(dept, comp?.code);
    setItems([]);
    setCatalogItems([]);
    setSales([]);
    setParties([]);
    triggerGlobalDataRefresh('company-switch');
    fetchData();
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
      const firstTab = getFirstOnlineTab();
      setActiveTab(firstTab);
    }
  };

  // Auto-request Push Notification permission on site open & register browser Web Push
  useEffect(() => {
    if (isAuthenticated) {
      const subscribePush = async () => {
        try {
          const userId = currentUser?._id || currentUser?.id;
          if ('Notification' in window) {
            if (Notification.permission === 'default') {
              const perm = await Notification.requestPermission();
              if (perm === 'granted') {
                await webPushClient.subscribeToPush(userId);
                triggerPushNotification('Push Notifications Active 🔔', 'You will receive real-time popups for Chat, Tasks, and Operations.', 'success');
              }
            } else if (Notification.permission === 'granted') {
              await webPushClient.subscribeToPush(userId);
            }
          }
        } catch (e) {
          console.warn('[App] Push notification subscription error:', e);
        }
      };
      subscribePush();
    }
  }, [isAuthenticated, currentUser]);

  // Tab permission validation — ONLY reset activeTab if the tab is truly forbidden
  useEffect(() => {
    if (!isAuthenticated || !currentUser) return;
    if (api.isClientUser() || currentUser.isClient || currentUser.role === 'Client') return;

    const ALL_SYSTEM_TABS = [
      'dashboard', 'workspace', 'communication', 'elite_online', 'inventory', 'catalog', 'returns', 'sales', 'reports', 'unicommerce', 'myntra', 'admin',
      'ee_dashboard', 'ee_invoices', 'ee_settings', 'ee_complaints', 'ee_expenses',
      'ef_dashboard', 'ef_invoices', 'ef_settings', 'ef_complaints', 'ef_expenses',
      'es_dashboard', 'es_settings', 'es_complaints', 'es_expenses', 'eo_complaints', 'eo_expenses', 'eo_settings',
      'jobcards', 'jobcards_list', 'jobcards_catalogue', 'jobcards_tracking', 'jobcards_master', 'jobcards_fabric', 'jobcards_raw_materials', 'jobcards_settings',
      'jobcards_stitching_challan', 'jobcards_stitching_settings',
      'jobcards_printing_log', 'jobcards_fusing_log', 'jobcards_print_entry', 'jobcards_billing', 'jobcards_costing', 'jobcards_engine', 'jobcards_split_view', 'jobcards_challan', 'jobcards_complain', 'jobcards_expense',
      'jobcards_expenses', 'expense_dashboard', 'expense_create', 'expenses', 'jobcards_qa', 'qa', 'qa_dashboard', 'jobcards_crm', 'crm_department', 'crm', 'crm_profiles', 'crm_leads', 'jobcards_master_ai', 'master_ai_agent',
      'jobcards_business_connection', 'business_connection', 'complaint_dashboard', 'complaint_create'
    ];

    if (isSuperOrAdmin) {
      // Admins and Super Admins have access to all system tabs
      if (!ALL_SYSTEM_TABS.includes(activeTab)) {
        setActiveTab('dashboard');
      }
      return;
    }

    // If user is accessing communication or task management and has workspace access, allow
    if (['communication', 'workspace'].includes(activeTab) && hasCommunicationAccess) return;
    if (activeTab === 'task_management' && hasTaskAccess) return;

    // Check company-level workspace tab access
    if (activeDepartment === 'elite_online' && hasEliteOnlineAccess) {
      if (ELITE_ONLINE_PERMISSIONS.includes(activeTab) || activeTab.startsWith('eo_')) return;
    }
    if (activeDepartment === 'elite_edition' && hasEliteEditionAccess) {
      if (ELITE_EDITION_PERMISSIONS.includes(activeTab) || activeTab.startsWith('ee_')) return;
    }
    if (activeDepartment === 'elite_fabtex' && hasEliteFabtexAccess) {
      if (ELITE_FABTEX_PERMISSIONS.includes(activeTab) || activeTab.startsWith('ef_')) return;
    }

    const userPerms = currentUser.permissions || [];
    const isAllowed = userPerms.some(p => {
      if (p === activeTab) return true;
      if (['communication', 'workspace'].includes(activeTab) && (p === 'workspace' || p === 'interdept-communication' || p === 'communication')) return true;
      if (activeTab === 'task_management' && (p === 'task_management' || p === 'task-manager' || p === 'tasks')) return true;
      if (activeTab.startsWith('ee_') && hasEliteEditionAccess) return p === activeTab || p === 'ee_dashboard';
      if (activeTab.startsWith('ef_') && hasEliteFabtexAccess) return p === activeTab || p === 'ef_dashboard';
      if (activeTab.startsWith('es_') && hasStitchingAccess) return true;
      if (activeTab.startsWith('eo_') && hasEliteOnlineAccess) return true;
      if (activeTab === 'catalog' && p === 'inventory') return true;
      if (activeTab === 'jobcards_list' && (p === 'stitching_jobcards' || p === 'jobcards_list' || p === 'jobcards')) return true;
      if (activeTab === 'jobcards_catalogue' && (p === 'stitching_design' || p === 'jobcards_catalogue' || p === 'jobcards')) return true;
      if ((activeTab === 'jobcards_stitching_challan' || activeTab === 'jobcards_fabric') && (p === 'stitching_fabric' || p === 'jobcards_stitching_challan' || p === 'jobcards_fabric')) return true;
      if (activeTab === 'jobcards_stitching_settings' && (p === 'stitching_settings' || p === 'jobcards_stitching_settings')) return true;
      if ((activeTab === 'jobcards_business_connection' || activeTab === 'business_connection') && (p === 'jobcards_business_connection' || p === 'business_connection' || p === 'jobcards_master_ai' || p === 'jobcards')) return true;
      if ((activeTab === 'jobcards_crm' || activeTab === 'crm_leads' || activeTab === 'crm_profiles') && (p === 'jobcards_crm' || p === 'crm_department' || p === 'crm' || p === 'crm_leads' || p === 'crm_profiles' || p === 'jobcards')) return true;
      if (activeTab.startsWith('jobcards_') && (p === 'jobcards' || p === activeTab)) return true;
      if (activeTab === 'jobcards' && p.startsWith('jobcards')) return true;
      if (activeTab.startsWith('stitching_') && (p.startsWith('stitching_') || p === 'jobcards')) return true;
      return false;
    });

    if (!isAllowed) {
      if (activeDepartment === 'elite_online' && hasEliteOnlineAccess) {
        setActiveTab(getFirstOnlineTab());
      } else if (activeDepartment === 'digital_print' && hasDigitalPrintAccess) {
        setActiveTab(getFirstJobCardsTab());
      } else if (activeDepartment === 'stitching' && hasStitchingAccess) {
        setActiveTab(getFirstStitchingTab());
      } else if (activeDepartment === 'elite_edition' && hasEliteEditionAccess) {
        setActiveTab(getFirstEETab());
      } else if (activeDepartment === 'elite_fabtex' && hasEliteFabtexAccess) {
        setActiveTab(getFirstEFTab());
      } else if (hasCommunicationAccess) {
        setActiveTab('communication');
      } else if (hasTaskAccess) {
        setActiveTab('task_management');
      } else if (userPerms.length > 0) {
        setActiveTab(userPerms[0]);
      } else {
        setActiveTab('no-access');
      }
    }
  }, [currentUser?.role, JSON.stringify(currentUser?.permissions || []), isAuthenticated, activeDepartment, hasCommunicationAccess, hasTaskAccess, hasEliteOnlineAccess, hasEliteEditionAccess, hasEliteFabtexAccess, hasDigitalPrintAccess, hasStitchingAccess, isSuperOrAdmin]);


  
  // Modal states
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingItem, setEditingItem] = useState(null);
  const [formMode, setFormMode] = useState('inventory'); // 'inventory' or 'catalog'
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

  const [notificationPerm, setNotificationPerm] = useState(() => ('Notification' in window ? Notification.permission : 'unsupported'));

  useEffect(() => {
    const handleNotifUpdate = () => {
      setUnreadNotifCount(getNotificationHistory().filter(h => !h.read).length);
    };
    window.addEventListener('elite-notification-history-update', handleNotifUpdate);
    return () => window.removeEventListener('elite-notification-history-update', handleNotifUpdate);
  }, []);

  // Auto-request push notification permission as soon as user logs in or reloads page
  useEffect(() => {
    if (!isAuthenticated) return;

    if ('Notification' in window && Notification.permission === 'default') {
      const askPerm = async () => {
        try {
          const res = await requestNotificationPermission();
          setNotificationPerm(res);
          if (res === 'denied') {
            setShowPermHelpModal(true);
          }
        } catch (e) {
          console.warn('Deferred notification prompt:', e);
        }
      };

      const handleUserInteraction = () => {
        askPerm();
        window.removeEventListener('click', handleUserInteraction);
        window.removeEventListener('keydown', handleUserInteraction);
      };

      window.addEventListener('click', handleUserInteraction);
      window.addEventListener('keydown', handleUserInteraction);

      const timer = setTimeout(() => {
        if (Notification.permission === 'default') {
          askPerm();
        }
      }, 1500);

      return () => {
        clearTimeout(timer);
        window.removeEventListener('click', handleUserInteraction);
        window.removeEventListener('keydown', handleUserInteraction);
      };
    }
  }, [isAuthenticated, permSnoozedSession]);

  const [showPermissionsModal, setShowPermissionsModal] = useState(false);

  useEffect(() => {
    if (isAuthenticated) {
      fetchData();
      // NO MORE 60s background polling! 100% Real-time Socket.io events across all screens!

      const handleDataRefresh = () => {
        fetchData();
      };
      window.addEventListener('elite-data-refresh', handleDataRefresh);

      return () => {
        window.removeEventListener('elite-data-refresh', handleDataRefresh);
      };
    }
  }, [isAuthenticated]);

  // Global Socket.io Real-Time Push Notification & Multi-Department Listener
  useEffect(() => {
    if (!socket || !isAuthenticated || typeof socket.emit !== 'function' || typeof socket.on !== 'function') return;

    if (currentUser) {
      const uId = currentUser.id || currentUser._id;
      if (uId) {
        socket.emit('register-user', uId);
      }
    }

    const handleReceiveMessage = (msg) => {
      if (!msg) return;
      const myId = String(currentUser?._id || currentUser?.id || '');
      const senderObj = msg.senderId;
      const senderIdStr = String(typeof senderObj === 'object' ? (senderObj?._id || senderObj?.id || senderObj) : senderObj);

      // Do not trigger notification for messages sent by current user
      if (myId && senderIdStr === myId) return;

      const senderName = typeof senderObj === 'object' ? (senderObj?.name || senderObj?.username || 'Colleague') : 'Colleague';
      const msgContent = msg.type === 'record-card' ? `🃏 Shared Record Card: ${msg.content}` : (msg.attachment ? `📎 [${msg.attachment.fileType || 'Attachment'}] ${msg.content}` : msg.content);

      if (activeTab !== 'communication' && activeTab !== 'workspace') {
        setChatUnreadCount((prev) => prev + 1);
      }

      triggerPushNotification(
        `💬 Chat from ${senderName}`,
        msgContent,
        'info',
        'communication'
      );
    };

    const handleActivity = (data) => {
      console.log('⚡ Real-time Socket Activity:', data);
      if (data && data.description) {
        triggerPushNotification(
          data.title || `⚡ Activity Log (${data.module || 'System'})`,
          data.description,
          'info',
          data.actionTab || 'communication'
        );
      }
      triggerGlobalDataRefresh();
    };

    const handleOverdue = (data) => {
      if (data && data.message) {
        triggerPushNotification('🚨 OVERDUE TASK ALERT', data.message, 'warning', 'communication');
      }
      triggerGlobalDataRefresh();
    };

    const handleMention = (data) => {
      if (data && data.content) {
        triggerPushNotification(`💬 Mentioned by ${data.senderName || 'Colleague'}`, data.content, 'info', 'communication');
      }
    };

    const handleJobStageUpdate = (data) => {
      if (data && data.jobNo) {
        triggerPushNotification('⚙️ Job Stage Updated', `Job #${data.jobNo} moved to '${data.newStage}'`, 'success', 'jobcards_list');
      }
      triggerGlobalDataRefresh();
    };

    const handleDataUpdate = (event) => {
      // If user is currently editing the record that was updated by someone else, show conflict notice
      if (event && event.id && editingItem && (editingItem._id === event.id || editingItem.id === event.id)) {
        setConflictRecord(event);
        return; // Non-destructive: do NOT overwrite user's unsaved form input!
      }

      // Direct patch local state if payload is provided
      if (event && event.entity) {
        const id = event.id;
        if (event.action === 'deleted') {
          setItems(prev => prev.filter(i => i._id !== id && i.id !== id));
          setSales(prev => prev.filter(s => s._id !== id && s.id !== id));
          setCatalogItems(prev => prev.filter(c => c._id !== id && c.id !== id));
        } else if (event.action === 'updated' && event.payload) {
          setItems(prev => prev.map(i => (i._id === id || i.id === id) ? { ...i, ...event.payload } : i));
          setSales(prev => prev.map(s => (s._id === id || s.id === id) ? { ...s, ...event.payload } : s));
          setCatalogItems(prev => prev.map(c => (c._id === id || c.id === id) ? { ...c, ...event.payload } : c));
        } else if (event.action === 'created' && event.payload) {
          if (event.entity === 'item' || event.entity === 'inventory') {
            setItems(prev => [event.payload, ...prev.filter(i => i._id !== id && i.id !== id)]);
          } else if (event.entity === 'sale' || event.entity === 'sales') {
            setSales(prev => [event.payload, ...prev.filter(s => s._id !== id && s.id !== id)]);
          }
        }
      }

      triggerGlobalDataRefresh(event || 'socket');
    };

    const handleIncomingCallGlobal = (data) => {
      try {
        if ('Notification' in window && Notification.permission === 'granted') {
          const n = new Notification(`📞 Incoming ${data.callType === 'video' ? 'Video' : 'Voice'} Call`, {
            body: `${data.callerName || 'Team Member'} is calling you on Elite Edition... Click to answer!`,
            icon: '/Logo.png',
            tag: `call-${data.roomId}`,
            requireInteraction: true,
            vibrate: [300, 150, 300, 150, 400]
          });
          n.onclick = () => {
            window.focus();
            n.close();
            setActiveTab('communication');
          };
        }
      } catch (e) {}

      triggerPushNotification(
        `📞 Incoming ${data.callType === 'video' ? 'Video' : 'Voice'} Call`,
        `${data.callerName || 'Team Member'} is calling you. Click to Answer!`,
        'warning',
        'communication'
      );

      if (activeTab !== 'communication') {
        setGlobalIncomingCall(data);
      }
    };

    const handleCallDismissGlobal = () => {
      setGlobalIncomingCall(null);
    };

    socket.on('incoming-call', handleIncomingCallGlobal);
    socket.on('call-ended', handleCallDismissGlobal);
    socket.on('call-declined', handleCallDismissGlobal);
    socket.on('call-accepted', handleCallDismissGlobal);
    socket.on('receive-message', handleReceiveMessage);
    socket.on('activity-notification', handleActivity);
    socket.on('overdue-task-alert', handleOverdue);
    socket.on('mention-notification', handleMention);
    socket.on('job-stage-updated', handleJobStageUpdate);
    socket.on('job-updated', handleDataUpdate);
    socket.on('job-created', handleDataUpdate);
    socket.on('job-deleted', handleDataUpdate);
    socket.on('design-updated', handleDataUpdate);
    socket.on('design-created', handleDataUpdate);
    socket.on('design-deleted', handleDataUpdate);
    socket.on('invoice-updated', handleDataUpdate);
    socket.on('invoice-created', handleDataUpdate);
    socket.on('invoice-deleted', handleDataUpdate);
    socket.on('complaint-updated', handleDataUpdate);
    socket.on('complaint-created', handleDataUpdate);
    socket.on('complaint-deleted', handleDataUpdate);
    socket.on('expense-updated', handleDataUpdate);
    socket.on('expense-created', handleDataUpdate);
    socket.on('expense-deleted', handleDataUpdate);
    socket.on('inventory-updated', handleDataUpdate);
    socket.on('inventory-created', handleDataUpdate);
    socket.on('inventory-deleted', handleDataUpdate);
    socket.on('sales-updated', handleDataUpdate);
    socket.on('sales-created', handleDataUpdate);
    socket.on('sales-deleted', handleDataUpdate);
    socket.on('task-updated', handleDataUpdate);
    socket.on('task-deleted', handleDataUpdate);
    socket.on('task-created', handleDataUpdate);
    socket.on('proof-status-updated', handleDataUpdate);
    socket.on('global-room-updated', handleDataUpdate);
    socket.on('fabric-updated', handleDataUpdate);
    socket.on('catalog-updated', handleDataUpdate);
    socket.on('stock-out-created', handleDataUpdate);
    socket.on('returns-updated', handleDataUpdate);
    socket.on('data-changed', handleDataUpdate);

    return () => {
      if (!socket || typeof socket.off !== 'function') return;
      socket.off('incoming-call', handleIncomingCallGlobal);
      socket.off('call-ended', handleCallDismissGlobal);
      socket.off('call-declined', handleCallDismissGlobal);
      socket.off('call-accepted', handleCallDismissGlobal);
      socket.off('receive-message', handleReceiveMessage);
      socket.off('activity-notification', handleActivity);
      socket.off('overdue-task-alert', handleOverdue);
      socket.off('mention-notification', handleMention);
      socket.off('job-stage-updated', handleJobStageUpdate);
      socket.off('job-updated', handleDataUpdate);
      socket.off('job-created', handleDataUpdate);
      socket.off('job-deleted', handleDataUpdate);
      socket.off('design-updated', handleDataUpdate);
      socket.off('design-created', handleDataUpdate);
      socket.off('design-deleted', handleDataUpdate);
      socket.off('invoice-updated', handleDataUpdate);
      socket.off('invoice-created', handleDataUpdate);
      socket.off('invoice-deleted', handleDataUpdate);
      socket.off('complaint-updated', handleDataUpdate);
      socket.off('complaint-created', handleDataUpdate);
      socket.off('complaint-deleted', handleDataUpdate);
      socket.off('expense-updated', handleDataUpdate);
      socket.off('expense-created', handleDataUpdate);
      socket.off('expense-deleted', handleDataUpdate);
      socket.off('inventory-updated', handleDataUpdate);
      socket.off('inventory-created', handleDataUpdate);
      socket.off('inventory-deleted', handleDataUpdate);
      socket.off('sales-updated', handleDataUpdate);
      socket.off('sales-created', handleDataUpdate);
      socket.off('sales-deleted', handleDataUpdate);
      socket.off('task-updated', handleDataUpdate);
      socket.off('task-deleted', handleDataUpdate);
      socket.off('task-created', handleDataUpdate);
      socket.off('proof-status-updated', handleDataUpdate);
      socket.off('global-room-updated', handleDataUpdate);
      socket.off('fabric-updated', handleDataUpdate);
      socket.off('catalog-updated', handleDataUpdate);
      socket.off('stock-out-created', handleDataUpdate);
      socket.off('returns-updated', handleDataUpdate);
      socket.off('data-changed', handleDataUpdate);
    };
  }, [socket, isAuthenticated, currentUser?._id]);

  const fetchData = async () => {
    if (api.isClientUser()) {
      const clientData = api.getClientData();
      if (clientData) {
        setCurrentUser(clientData);
      }
      setLoading(false);
      return;
    }

    setLoading(true);
    setError('');
    try {
      // Run requests in parallel including user permissions sync
      const [inventoryResult, catalogResult, salesResult, partiesResult, userResult] = await Promise.allSettled([
        api.getInventory(),
        api.getProductsCatalog(),
        api.getSales({ limit: 200 }),
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
    socketManager.disconnect();
    api.logout();
    setIsAuthenticated(false);
    setCurrentUser(null);
    setItems([]);
    setSales([]);
    try {
      if ('caches' in window) {
        caches.keys().then((keys) => {
          keys.forEach((key) => {
            if (key.includes('runtime') || key.includes('user') || key.includes('api')) {
              caches.delete(key);
            }
          });
        });
      }
      sessionStorage.clear();
    } catch (e) {}
  };

  // Catalog Sync Handler
  const handleSyncCatalog = async () => {
    setLoading(true);
    try {
      const res = await api.syncMissingProducts();
      triggerEliteAlert('Catalog Sync', res.message || 'Product catalog sync triggered successfully!', 'success');
      await fetchData();
    } catch (err) {
      triggerEliteAlert('Catalog Sync Error', err.message || 'Failed to sync catalog.', 'error');
    } finally {
      setLoading(false);
    }
  };

  // Ensure missing SKU is saved to Master Product Catalog
  const ensureSkuSavedToCatalog = async (itemOrData) => {
    try {
      const skuCode = (itemOrData.skuCode || '').trim();
      if (!skuCode) return;

      const existsInCatalog = catalogItems.some(c => 
        (c.skuCode && c.skuCode.trim().toLowerCase() === skuCode.toLowerCase()) ||
        matchSkuOrBrandCode(c, skuCode)
      );

      if (!existsInCatalog) {
        const catPayload = {
          skuCode: skuCode,
          description: itemOrData.itemName || itemOrData.description || skuCode,
          brand: itemOrData.party || itemOrData.brand || 'ELITE EDITION',
          size: itemOrData.size || '',
          basePrice: Number(itemOrData.purchasePrice ?? itemOrData.basePrice) || 0.0,
          price: Number(itemOrData.salePrice ?? itemOrData.price) || 0.0,
          imageUrl: itemOrData.imageUrl || '',
          categoryName: itemOrData.categoryName || 'KURTA SET',
          hsnCode: itemOrData.hsnCode || '',
          brandCodes: itemOrData.brandCodes || [],
        };
        const newCat = await api.createProductCatalog(catPayload).catch(err => null);
        if (newCat) {
          setCatalogItems(prev => [newCat, ...prev]);
        }
      }
    } catch (e) {
      console.warn('ensureSkuSavedToCatalog error:', e);
    }
  };

  // CRUD Handler Functions
  const handleAddSubmit = async (formData) => {
    setLoading(true);
    try {
      const payload = {
        skuCode: formData.skuCode,
        description: formData.itemName || formData.description || formData.skuCode,
        brand: formData.party || formData.brand || 'ELITE EDITION',
        size: formData.size,
        basePrice: Number(formData.purchasePrice ?? formData.basePrice) || 0.0,
        price: Number(formData.salePrice ?? formData.price) || 0.0,
        imageUrl: formData.imageUrl || '',
        categoryName: formData.categoryName || 'KURTA SET',
        hsnCode: formData.hsnCode || '',
        brandCodes: formData.brandCodes || [],
      };
      const newProduct = await api.createProductCatalog(payload);
      if (newProduct) {
        setCatalogItems(prev => [newProduct, ...prev.filter(c => c._id !== newProduct._id && c.skuCode !== newProduct.skuCode)]);
      }
      setIsFormOpen(false);
      triggerGlobalDataRefresh();
      await fetchData();
    } catch (err) {
      triggerEliteAlert('Creation Error', err.message || 'Failed to create product in catalog.', 'error');
    } finally {
      setLoading(false);
      restoreSavedScrollPos();
    }
  };

  const handleEditSubmit = async (formData) => {
    if (!editingItem || !editingItem._id) return;
    setLoading(true);
    try {
      const isCatalog = activeTab === 'catalog' || catalogItems.some(c => c._id === editingItem._id) || 'basePrice' in editingItem;
      if (isCatalog) {
        const payload = {
          skuCode: formData.skuCode,
          description: formData.itemName || formData.description,
          brand: formData.party || formData.brand,
          size: formData.size,
          basePrice: formData.purchasePrice ?? formData.basePrice,
          price: formData.salePrice ?? formData.price,
          imageUrl: formData.imageUrl,
          categoryName: formData.categoryName || '',
          hsnCode: formData.hsnCode || '',
          brandCodes: formData.brandCodes || [],
        };
        await api.updateProductCatalog(editingItem._id, payload);
      } else {
        const updatedItem = await api.updateInventory(editingItem._id, formData);
        setItems(prev => prev.map(item => item._id === editingItem._id ? { ...item, ...updatedItem } : item));
      }
      setIsFormOpen(false);
      setEditingItem(null);
      triggerGlobalDataRefresh();
      await fetchData();
    } catch (err) {
      triggerEliteAlert('Update Error', err.message || 'Failed to update item.', 'error');
    } finally {
      setLoading(false);
      restoreSavedScrollPos();
    }
  };

  const handleDeleteItem = async (id) => {
    const isCatalog = activeTab === 'catalog' || catalogItems.some(c => c._id === id);
    if (isCatalog) {
      const confirmed = await triggerEliteConfirm({
        title: 'Delete Catalog Product',
        message: 'Are you sure you want to delete this product from the catalog?',
        confirmText: 'Delete Product',
        cancelText: 'Cancel',
        type: 'danger'
      });
      if (!confirmed) return;

      setLoading(true);
      try {
        await api.deleteProductCatalog(id);
        setCatalogItems(prev => prev.filter(item => item._id !== id));
        triggerGlobalDataRefresh();
      } catch (err) {
        triggerEliteAlert('Delete Error', err.message || 'Failed to delete product from catalog.', 'error');
      } finally {
        setLoading(false);
        restoreSavedScrollPos();
      }
    } else {
      const confirmed = await triggerEliteConfirm({
        title: 'Delete Inventory Item',
        message: 'Are you sure you want to delete this inventory item?',
        confirmText: 'Delete Item',
        cancelText: 'Cancel',
        type: 'danger'
      });
      if (!confirmed) return;

      setLoading(true);
      try {
        await api.deleteInventory(id);
        setItems(prev => prev.filter(item => item._id !== id));
        triggerGlobalDataRefresh();
      } catch (err) {
        triggerEliteAlert('Delete Error', err.message || 'Failed to delete inventory item.', 'error');
      } finally {
        setLoading(false);
        restoreSavedScrollPos();
      }
    }
  };

  const handleQuickStockUpdate = async (id, newStock) => {
    try {
      await api.updateInventory(id, { currentlyAvailableStock: newStock, qty: newStock });
      setItems(prev => prev.map(item => item._id === id ? { ...item, currentlyAvailableStock: newStock, qty: newStock } : item));
      triggerGlobalDataRefresh();
    } catch (err) {
      console.error('Failed to update stock:', err);
      triggerEliteAlert('Stock Update Failed', err.message || 'Failed to update stock level.', 'error');
    }
  };

  const handleBulkInwardSubmit = async (parsedItems) => {
    setLoading(true);
    try {
      const res = await api.bulkInward(parsedItems);
      if (Array.isArray(parsedItems)) {
        for (const item of parsedItems) {
          await ensureSkuSavedToCatalog(item);
        }
      }
      setIsBulkInwardOpen(false);
      triggerGlobalDataRefresh();
      await fetchData();
      triggerEliteAlert('Bulk Inward Complete', res.message || 'Bulk inward completed successfully!', 'success');
    } catch (err) {
      triggerEliteAlert('Bulk Inward Error', err.message || 'Failed to process bulk inward.', 'error');
    } finally {
      setLoading(false);
      restoreSavedScrollPos();
    }
  };

  const handleStockOutSubmit = async (payload) => {
    setLoading(true);
    try {
      await api.createStockOut(payload);
      setIsStockOutOpen(false);
      setStockOutItem(null);
      triggerGlobalDataRefresh();
      await fetchData();
      triggerEliteAlert('Outward Complete', 'Outward dispatch completed successfully!', 'success');
    } catch (err) {
      triggerEliteAlert('Outward Error', err.message || 'Failed to submit outward transaction.', 'error');
    } finally {
      setLoading(false);
      restoreSavedScrollPos();
    }
  };

  const savedModalScrollRef = useRef(0);

  // Disable browser automatic scroll restoration & track scroll Y continuously
  useEffect(() => {
    if (typeof window !== 'undefined' && 'scrollRestoration' in window.history) {
      window.history.scrollRestoration = 'manual';
    }
    const handleScroll = () => {
      if (!isFormOpen && !isStockOutOpen && !isManagerOpen && !isBulkInwardOpen) {
        const y = window.scrollY || document.documentElement.scrollTop || 0;
        if (y > 0) {
          savedModalScrollRef.current = y;
        }
      }
    };
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, [isFormOpen, isStockOutOpen, isManagerOpen, isBulkInwardOpen]);

  const triggerStockOutModal = (item = null) => {
    savedModalScrollRef.current = window.scrollY || document.documentElement.scrollTop || 0;
    setStockOutItem(item);
    setIsStockOutOpen(true);
  };

  const triggerAddModal = (targetMode) => {
    savedModalScrollRef.current = window.scrollY || document.documentElement.scrollTop || 0;
    setEditingItem(null);
    const resolvedMode = (targetMode === 'catalog' || targetMode === 'inventory')
      ? targetMode
      : (activeTab === 'catalog' ? 'catalog' : 'inventory');
    setFormMode(resolvedMode);
    setIsFormOpen(true);
  };

  const triggerEditModal = (item) => {
    savedModalScrollRef.current = window.scrollY || document.documentElement.scrollTop || 0;
    const titleOrDescription = item.description || item.itemName || item.name || item.title || item.productName || item.skuCode || '';
    const isCatalog = activeTab === 'catalog';
    setFormMode(isCatalog ? 'catalog' : 'inventory');
    if (isCatalog) {
      const adapted = {
        _id: item._id,
        itemName: titleOrDescription,
        description: titleOrDescription,
        party: item.brand || item.party || 'ANOUK',
        brand: item.brand || item.party || 'ANOUK',
        size: Array.isArray(item.size) ? item.size.join(', ') : item.size || '',
        purchasePrice: item.basePrice ?? item.purchasePrice ?? 0.0,
        salePrice: item.price ?? item.salePrice ?? 0.0,
        skuCode: item.skuCode || item.sku || '',
        imageUrl: item.imageUrl || '',
        currentlyAvailableStock: item.inventorySnapshots?.inventory ?? item.currentlyAvailableStock ?? item.qty ?? 0,
        qty: item.inventorySnapshots?.inventory ?? item.currentlyAvailableStock ?? item.qty ?? 0,
        brandCodes: item.brandCodes || [],
      };
      setEditingItem(adapted);
    } else {
      setEditingItem({
        ...item,
        itemName: titleOrDescription,
        description: titleOrDescription,
      });
    }
    setIsFormOpen(true);
  };

  const triggerManagerModal = (tabName = 'vendors') => {
    savedModalScrollRef.current = window.scrollY || document.documentElement.scrollTop || 0;
    setManagerTab(tabName);
    setIsManagerOpen(true);
  };

  const restoreSavedScrollPos = (explicitPos = null) => {
    const targetY = explicitPos !== null ? explicitPos : (savedModalScrollRef.current || 0);
    if (typeof window === 'undefined') return;

    if (document.activeElement && typeof document.activeElement.blur === 'function') {
      document.activeElement.blur();
    }

    const doScroll = () => {
      window.scrollTo({ top: targetY, behavior: 'instant' });
    };

    doScroll();
    requestAnimationFrame(doScroll);
    setTimeout(doScroll, 30);
    setTimeout(doScroll, 100);
    setTimeout(doScroll, 300);
  };

  // Update server endpoint dynamically
  const applyServerEndpoint = () => {
    setBaseUrl(tempUrl);
    setServerEndpoint(getBaseUrl());
    setShowServerSettings(false);
    fetchData();
  };

  if (!isAuthenticated) {
    if (isClientPortalMode) {
      return (
        <Suspense fallback={
          <div style={{ minHeight: '100vh', background: '#f0f4f8', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#2563eb' }}>
            <RefreshCw size={32} className="spin-loader" />
          </div>
        }>
          <ClientLogin
            onLoginSuccess={handleLoginSuccess}
            onSwitchToStaff={() => {
              if (window.location.hash.includes('client')) {
                window.location.hash = '';
              }
              setIsClientPortalMode(false);
            }}
          />
        </Suspense>
      );
    }
    return (
      <Login
        onLoginSuccess={handleLoginSuccess}
        onSwitchToClient={() => {
          window.location.hash = '#client-login';
          setIsClientPortalMode(true);
        }}
      />
    );
  }

  // If authenticated as a Client Partner
  if (api.isClientUser() || currentUser?.isClient || currentUser?.role === 'Client') {
    const activeClient = (currentUser && (currentUser._id || currentUser.companyName || currentUser.companyCode))
      ? currentUser
      : api.getClientData();
    return (
      <Suspense fallback={
        <div style={{ minHeight: '100vh', background: '#f0f4f8', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#2563eb' }}>
          <RefreshCw size={32} className="spin-loader" />
        </div>
      }>
        <ClientPortal
          client={activeClient}
          onLogout={handleLogout}
        />
      </Suspense>
    );
  }

  return (
    <div style={styles.appContainer} className="app-container">
      {/* Non-Intrusive Floating Offline Connection Banner */}
      <OfflineBanner />

      {updateWaitingWorker && (
        <div className="pwa-update-bar">
          <span>Update available</span>
          <button onClick={handleApplyUpdate}>Reload</button>
        </div>
      )}

      {showIosInstallHint && !isStandalone && (
        <div className="pwa-ios-hint">
          <span>Install app: Tap Share then 'Add to Home Screen'</span>
          <button onClick={() => {
            try { localStorage.setItem('dismissed_ios_install_hint', 'true'); } catch (e) {}
            setShowIosInstallHint(false);
          }}>
            Dismiss
          </button>
        </div>
      )}

      {/* Notifications permission bar - minimal */}
      {isAuthenticated && notificationPerm === 'denied' && !permSnoozedSession && (
        <div style={{
          background: 'var(--danger-bg, #fef2f2)',
          borderBottom: '1px solid var(--danger-border, #fecaca)',
          color: 'var(--danger-text, #991b1b)',
          padding: '8px 16px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          fontSize: 'var(--font-size-meta, 0.75rem)',
          gap: '8px',
          flexWrap: 'wrap',
          zIndex: 9999,
          position: 'relative'
        }}>
          <span>Notifications are blocked. Please enable them in browser settings for alerts.</span>
          <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
            <button
              onClick={() => setShowPermHelpModal(true)}
              className="btn-secondary"
              style={{ minHeight: '32px', padding: '4px 10px', fontSize: 'var(--font-size-meta, 0.75rem)' }}
            >
              Settings
            </button>
            <button
              onClick={() => {
                try { sessionStorage.setItem('elite_perm_snoozed_session', 'true'); } catch (e) {}
                setPermSnoozedSession(true);
              }}
              style={{ background: 'none', border: 'none', color: 'var(--text-muted, #64748b)', cursor: 'pointer', fontSize: 'var(--font-size-meta, 0.75rem)' }}
            >
              Dismiss
            </button>
          </div>
        </div>
      )}


      {/* Top Navbar */}
      <header className="glass-panel app-header" style={styles.header}>
        <div style={styles.headerLeft} className="header-left-wrap">
          <button
            onClick={handleMenuButtonClick}
            className="mobile-menu-toggle"
            aria-label="Toggle Navigation Menu"
            title="Menu"
          >
            {mobileMenuOpen ? <X size={20} /> : <Menu size={20} />}
          </button>

          {/* Company Switcher Pill in Top Bar */}
          {(() => {
            const activeComp = getCompanyById(activeDepartment);
            const isCommActive = ['workspace', 'communication', 'task_management'].includes(activeTab);
            const hasAnyAllowedDept = hasEliteOnlineAccess ||
              hasDigitalPrintAccess ||
              hasStitchingAccess ||
              hasEliteEditionAccess ||
              hasEliteFabtexAccess;

            if (!hasAnyAllowedDept && isCommActive) return null;

            return (
              <button 
                onClick={() => setShowCompanyQuickSheet(true)}
                className="btn-secondary mobile-company-pill"
                style={{
                  minHeight: '38px',
                  padding: '6px 12px',
                  fontSize: 'var(--font-size-body, 0.88rem)',
                  fontWeight: 600,
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px'
                }}
                title="Switch company"
                type="button"
              >
                <span>{isCommActive ? 'Communication' : (activeComp?.name || 'Elite Digital Prints')}</span>
                <span style={{ fontSize: 'var(--font-size-meta, 0.75rem)', color: 'var(--text-muted)' }}>▾</span>
              </button>
            );
          })()}

          {/* Master Company Switcher Buttons for Desktop */}
          <div className="dept-switcher-header">
            {(() => {
              const visibleCompanies = COMPANIES.filter(company => {
                if (!isCompanyAllowed(company.id) && !isCompanyAllowed(company.name)) return false;
                if (company.id === 'elite_online' && !hasEliteOnlineAccess) return false;
                if (company.id === 'digital_print' && !hasDigitalPrintAccess) return false;
                if (company.id === 'stitching' && !hasStitchingAccess) return false;
                if (company.id === 'elite_edition' && !hasEliteEditionAccess) return false;
                if (company.id === 'elite_fabtex' && !hasEliteFabtexAccess) return false;
                return true;
              });

              return (
                <>
                  {visibleCompanies.map(company => {
                    const isCommActive = ['communication', 'workspace', 'task_management'].includes(activeTab);
                    const isActive = activeDepartment === company.id && !isCommActive;

                    const renderCompanyIcon = () => {
                      switch (company.id) {
                        case 'digital_print': return <Printer size={13} style={{ flexShrink: 0 }} />;
                        case 'stitching': return <Scissors size={13} style={{ flexShrink: 0 }} />;
                        case 'elite_edition': return <Building size={13} style={{ flexShrink: 0 }} />;
                        case 'elite_fabtex': return <Layers size={13} style={{ flexShrink: 0 }} />;
                        case 'elite_online': return <Store size={13} style={{ flexShrink: 0 }} />;
                        default: return null;
                      }
                    };

                    return (
                      <button
                        key={company.id}
                        onClick={() => handleSwitchDepartment(company.id)}
                        className={`dept-switcher-btn ${isActive ? 'active' : ''}`}
                        title={`Switch to ${company.name} (${company.code})`}
                        type="button"
                      >
                        {renderCompanyIcon()}
                        <span>{company.code || company.name}</span>
                      </button>
                    );
                  })}

                  {visibleCompanies.length > 0 && (hasCommunicationAccess || hasTaskAccess) && (
                    <div className="dept-switcher-divider" />
                  )}
                </>
              );
            })()}

            {(hasCommunicationAccess || hasTaskAccess) && (
              <>
                {hasCommunicationAccess && (
                  <button
                    onClick={() => {
                      setActiveTab('communication');
                      setMobileMenuOpen(false);
                      if (typeof window !== 'undefined' && window.innerWidth < 768) {
                        window.dispatchEvent(new CustomEvent('elite-open-chat-list'));
                      }
                    }}
                    className={`dept-switcher-btn comm-btn ${activeTab === 'communication' || activeTab === 'workspace' ? 'active' : ''}`}
                    title="Inter-Department Communication & Workforce Chat"
                    type="button"
                  >
                    <MessageSquare size={13} style={{ flexShrink: 0 }} />
                    <span>Communication</span>
                    {chatUnreadCount > 0 && (
                      <span className="dept-switcher-badge">
                        {chatUnreadCount}
                      </span>
                    )}
                  </button>
                )}

                {hasTaskAccess && (
                  <button
                    onClick={() => {
                      setActiveTab('task_management');
                      setMobileMenuOpen(false);
                    }}
                    className={`dept-switcher-btn comm-btn ${activeTab === 'task_management' ? 'active' : ''}`}
                    title="Task Management & Staff Workloads"
                    type="button"
                  >
                    <CheckSquare size={13} style={{ flexShrink: 0 }} />
                    <span>Tasks</span>
                  </button>
                )}
              </>
            )}
          </div>
        </div>

        <div style={styles.headerRight} className="header-right-wrap">
          {isMobile ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', position: 'relative' }}>
              <button
                type="button"
                onClick={() => setShowGlobalSearch(true)}
                className="btn-icon"
                title="Global Search"
                style={{
                  minWidth: '36px',
                  minHeight: '36px',
                  padding: '6px',
                  borderRadius: '8px',
                  border: '1px solid #e2e8f0',
                  background: '#ffffff',
                  color: '#475569',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  cursor: 'pointer'
                }}
              >
                <Search size={18} />
              </button>

              <button
                type="button"
                onClick={() => setShowNotificationDrawer(true)}
                className="btn-icon"
                title="Notifications & Alerts"
                style={{
                  minWidth: '36px',
                  minHeight: '36px',
                  padding: '6px',
                  borderRadius: '8px',
                  border: '1px solid #e2e8f0',
                  background: '#ffffff',
                  color: '#475569',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  position: 'relative',
                  cursor: 'pointer'
                }}
              >
                <Bell size={18} />
                {unreadNotifCount > 0 && (
                  <span style={{
                    position: 'absolute',
                    top: '4px',
                    right: '4px',
                    width: '8px',
                    height: '8px',
                    borderRadius: '50%',
                    background: '#ef4444'
                  }} />
                )}
              </button>

              <button
                type="button"
                onClick={() => setMobileHeaderMoreOpen(prev => !prev)}
                className="btn-icon"
                title="More Actions"
                style={{
                  minWidth: '36px',
                  minHeight: '36px',
                  padding: '6px',
                  borderRadius: '8px',
                  border: '1px solid #e2e8f0',
                  background: mobileHeaderMoreOpen ? '#f1f5f9' : '#ffffff',
                  color: '#475569',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  cursor: 'pointer'
                }}
              >
                <MoreHorizontal size={18} />
              </button>

              {mobileHeaderMoreOpen && (
                <>
                  <div
                    style={{ position: 'fixed', inset: 0, zIndex: 999 }}
                    onClick={() => setMobileHeaderMoreOpen(false)}
                  />
                  <div
                    style={{
                      position: 'absolute',
                      top: 'calc(100% + 6px)',
                      right: 0,
                      width: '210px',
                      background: '#ffffff',
                      borderRadius: '10px',
                      border: '1px solid #e2e8f0',
                      boxShadow: '0 10px 25px -5px rgba(0,0,0,0.1), 0 8px 10px -6px rgba(0,0,0,0.05)',
                      zIndex: 1000,
                      padding: '6px',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '4px',
                      animation: 'fadeInMenu 0.12s ease-out'
                    }}
                  >
                    <button
                      type="button"
                      onClick={() => {
                        setMobileHeaderMoreOpen(false);
                        fetchData();
                        triggerGlobalDataRefresh();
                        if (typeof window !== 'undefined' && window.showToast) {
                          window.showToast('Data refreshed', 'info');
                        }
                      }}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '8px',
                        padding: '8px 10px',
                        background: 'transparent',
                        border: 'none',
                        borderRadius: '6px',
                        fontSize: '0.82rem',
                        fontWeight: 500,
                        color: '#1e293b',
                        cursor: 'pointer',
                        textAlign: 'left'
                      }}
                    >
                      <RefreshCw size={15} />
                      <span>{loading ? 'Refreshing...' : 'Refresh Data'}</span>
                    </button>

                    {deferredInstallPrompt && !isStandalone && (
                      <button
                        type="button"
                        onClick={() => {
                          setMobileHeaderMoreOpen(false);
                          handleInstallClick();
                        }}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: '8px',
                          padding: '8px 10px',
                          background: '#eff6ff',
                          border: 'none',
                          borderRadius: '6px',
                          fontSize: '0.82rem',
                          fontWeight: 600,
                          color: '#2563eb',
                          cursor: 'pointer',
                          textAlign: 'left'
                        }}
                      >
                        <ShoppingBag size={15} />
                        <span>Install App</span>
                      </button>
                    )}

                    {currentUser && (
                      <div style={{ borderTop: '1px solid #f1f5f9', paddingTop: '4px', marginTop: '2px' }}>
                        <div style={{ padding: '6px 10px', fontSize: '0.74rem', color: '#64748b' }}>
                          Signed in as <strong style={{ color: '#0f172a' }}>{currentUser.name}</strong>
                        </div>
                        <button
                          type="button"
                          onClick={() => {
                            setMobileHeaderMoreOpen(false);
                            handleLogout();
                          }}
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '8px',
                            padding: '8px 10px',
                            background: 'transparent',
                            border: 'none',
                            borderRadius: '6px',
                            fontSize: '0.82rem',
                            fontWeight: 500,
                            color: '#ef4444',
                            cursor: 'pointer',
                            textAlign: 'left',
                            width: '100%'
                          }}
                        >
                          <LogOut size={15} />
                          <span>Sign Out</span>
                        </button>
                      </div>
                    )}
                  </div>
                </>
              )}
            </div>
          ) : (
            <>
              <button
                type="button"
                onClick={() => setShowGlobalSearch(true)}
                className="btn-secondary"
                title="Global Search (Ctrl/Cmd+K)"
                style={{
                  minHeight: '34px',
                  padding: '5px 10px',
                  fontSize: 'var(--font-size-meta, 0.75rem)',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px',
                  cursor: 'pointer'
                }}
              >
                <Search size={14} style={{ flexShrink: 0 }} />
                <span>Search</span>
                <kbd style={{
                  fontSize: '10px',
                  background: '#f1f5f9',
                  color: '#475569',
                  padding: '1px 5px',
                  borderRadius: '4px',
                  border: '1px solid #cbd5e1'
                }}>⌘K</kbd>
              </button>

              {deferredInstallPrompt && !isStandalone && (
                <button
                  onClick={handleInstallClick}
                  className="btn-primary"
                  title="Install Elite ERP App"
                  style={{ minHeight: '34px', padding: '5px 12px', fontSize: 'var(--font-size-meta, 0.75rem)', fontWeight: 600 }}
                >
                  Install App
                </button>
              )}

              {/* What's New Feature Changelog Drawer */}
              <ChangelogDrawer />

              <button
                onClick={() => setShowNotificationDrawer(true)}
                className="btn-secondary"
                title="Notifications & Alerts"
                style={{
                  minHeight: '34px',
                  padding: '5px 10px',
                  fontSize: 'var(--font-size-meta, 0.75rem)',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px'
                }}
              >
                <Bell size={14} style={{ flexShrink: 0 }} />
                <span>Alerts</span>
                {unreadNotifCount > 0 && (
                  <span style={{
                    background: '#ef4444',
                    color: '#ffffff',
                    padding: '1px 6px',
                    borderRadius: '10px',
                    fontSize: '0.68rem',
                    fontWeight: 800,
                    lineHeight: 1
                  }}>
                    {unreadNotifCount}
                  </span>
                )}
              </button>

              <button
                onClick={() => {
                  fetchData();
                  triggerGlobalDataRefresh();
                  if (typeof window !== 'undefined' && window.showToast) {
                    window.showToast('Data refreshed', 'info');
                  }
                }}
                className="btn-secondary"
                title="Refresh data"
                style={{
                  minHeight: '34px',
                  padding: '5px 10px',
                  fontSize: 'var(--font-size-meta, 0.75rem)',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px'
                }}
              >
                <RefreshCw size={13} className={loading ? 'spin-loader' : ''} style={{ flexShrink: 0 }} />
                <span>{loading ? 'Refreshing...' : 'Refresh'}</span>
              </button>

              {currentUser && (
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '10px',
                  paddingLeft: '6px',
                  borderLeft: '1px solid #e2e8f0'
                }}>
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start' }}>
                    <span style={{
                      fontSize: '0.84rem',
                      fontWeight: 700,
                      color: 'var(--text-primary)',
                      lineHeight: 1.2,
                      display: 'flex',
                      alignItems: 'center',
                      gap: '4px'
                    }}>
                      {(currentUser.isMainAdmin || currentUser.email === 'harshitsidapara2468@gmail.com') && <span>👑</span>}
                      {currentUser.name}
                    </span>
                    <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', textTransform: 'capitalize' }}>
                      {(currentUser.isMainAdmin || currentUser.email === 'harshitsidapara2468@gmail.com') ? 'Main Admin' : (currentUser.role || 'user')}
                    </span>
                  </div>
                  <button
                    onClick={handleLogout}
                    className="btn-secondary"
                    title="Sign Out"
                    style={{
                      minHeight: '34px',
                      padding: '5px 10px',
                      fontSize: 'var(--font-size-meta, 0.75rem)',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '5px'
                    }}
                  >
                    <LogOut size={13} style={{ flexShrink: 0 }} />
                    <span>Sign Out</span>
                  </button>
                </div>
              )}
            </>
          )}
        </div>
      </header>

      {/* Mobile Navigation Drawer Overlay (Minimal, Text links only, Safe Area) */}
      {mobileMenuOpen && (
        <div className="mobile-drawer-overlay" onClick={() => setMobileMenuOpen(false)}>
          <div className="mobile-drawer-content" onClick={(e) => e.stopPropagation()}>
            {/* Header: Company Name + Close Button */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid var(--border-color)', paddingBottom: '12px' }}>
              <div>
                <span style={{ fontWeight: 700, fontSize: '1rem', color: 'var(--text-primary)', display: 'block' }}>
                  {getCompanyById(activeDepartment)?.name || 'Elite Digital Prints'}
                </span>
                <span style={{ fontSize: 'var(--size-meta, 0.75rem)', color: 'var(--text-muted)' }}>
                  Navigation & Company Switcher
                </span>
              </div>
              <button 
                onClick={() => setMobileMenuOpen(false)} 
                className="btn-icon"
                aria-label="Close menu"
                style={{ minHeight: '44px', minWidth: '44px' }}
              >
                <X size={20} />
              </button>
            </div>

            {/* Section 1: Company Switcher (Plain text list) */}
            <div style={{ marginTop: '8px' }}>
              <div className="nav-section-header">Switch Company</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', marginTop: '6px' }}>
                {COMPANIES.map(company => {
                  if (!isCompanyAllowed(company.id) && !isCompanyAllowed(company.name)) return null;
                  if (company.id === 'elite_online' && !hasEliteOnlineAccess) return null;
                  if (company.id === 'digital_print' && !hasDigitalPrintAccess) return null;
                  if (company.id === 'stitching' && !hasStitchingAccess) return null;
                  if (company.id === 'elite_edition' && !hasEliteEditionAccess) return null;
                  if (company.id === 'elite_fabtex' && !hasEliteFabtexAccess) return null;

                  const isCurrent = activeDepartment === company.id;
                  return (
                    <button
                      key={company.id}
                      onClick={() => { handleSwitchDepartment(company.id); setMobileMenuOpen(false); }}
                      className={`mobile-drawer-item ${isCurrent ? 'active' : ''}`}
                    >
                      <span>{company.name}</span>
                      {isCurrent && <span style={{ fontSize: '0.75rem' }}>Active</span>}
                    </button>
                  );
                })}

                {hasCommunicationAccess && (
                  <button
                    onClick={() => {
                      setActiveTab('communication');
                      setMobileMenuOpen(false);
                      if (typeof window !== 'undefined') {
                        window.dispatchEvent(new CustomEvent('elite-open-chat-list'));
                      }
                    }}
                    className={`mobile-drawer-item ${activeTab === 'communication' || activeTab === 'workspace' ? 'active' : ''}`}
                  >
                    <span>Communication</span>
                    {chatUnreadCount > 0 && <span style={{ fontSize: '0.75rem' }}>({chatUnreadCount})</span>}
                  </button>
                )}

                {hasTaskAccess && (
                  <button
                    onClick={() => {
                      setActiveTab('task_management');
                      setMobileMenuOpen(false);
                    }}
                    className={`mobile-drawer-item ${activeTab === 'task_management' ? 'active' : ''}`}
                  >
                    <span>Tasks</span>
                  </button>
                )}
              </div>
            </div>

            {/* Section 2: Department Navigation Links (Plain text links only) */}
            <div style={{ marginTop: '8px', flex: 1 }}>
              <div className="nav-section-header">Modules</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', marginTop: '6px' }}>
                {activeDepartment === 'stitching' ? (
                  <>
                    {(!currentUser || currentUser.role === 'admin' || currentUser.permissions?.includes('jobcards_list') || currentUser.permissions?.includes('stitching_jobcards')) && (
                      <button onClick={() => { setActiveTab('jobcards_list'); setMobileMenuOpen(false); }} className={`mobile-drawer-item ${activeTab === 'jobcards_list' ? 'active' : ''}`}>
                        Jobcard
                      </button>
                    )}
                    {(!currentUser || currentUser.role === 'admin' || currentUser.permissions?.includes('jobcards_catalogue') || currentUser.permissions?.includes('stitching_design')) && (
                      <button onClick={() => { setActiveTab('jobcards_catalogue'); setMobileMenuOpen(false); }} className={`mobile-drawer-item ${activeTab === 'jobcards_catalogue' ? 'active' : ''}`}>
                        Design Room
                      </button>
                    )}
                    {(!currentUser || currentUser.role === 'admin' || currentUser.permissions?.includes('jobcards_fabric') || currentUser.permissions?.includes('jobcards_stitching_challan') || currentUser.permissions?.includes('stitching_fabric')) && (
                      <button onClick={() => { setActiveTab('jobcards_stitching_challan'); setMobileMenuOpen(false); }} className={`mobile-drawer-item ${(activeTab === 'jobcards_stitching_challan' || activeTab === 'jobcards_fabric') ? 'active' : ''}`}>
                        Challan
                      </button>
                    )}
                    <button onClick={() => { setActiveTab('es_complaints'); setMobileMenuOpen(false); }} className={`mobile-drawer-item ${activeTab === 'es_complaints' ? 'active' : ''}`}>
                      Complaints
                    </button>
                    {(!currentUser || currentUser.role === 'admin' || currentUser.permissions?.includes('jobcards_stitching_settings') || currentUser.permissions?.includes('stitching_settings')) && (
                      <button onClick={() => { setActiveTab('jobcards_stitching_settings'); setMobileMenuOpen(false); }} className={`mobile-drawer-item ${activeTab === 'jobcards_stitching_settings' ? 'active' : ''}`}>
                        Settings
                      </button>
                    )}
                  </>
                ) : activeDepartment === 'digital_print' ? (
                  <>
                    {(!currentUser || currentUser.role === 'admin' || currentUser.permissions?.includes('jobcards')) && (
                      <button onClick={() => { setActiveTab('jobcards'); setMobileMenuOpen(false); }} className={`mobile-drawer-item ${activeTab === 'jobcards' ? 'active' : ''}`}>
                        Prints Dashboard
                      </button>
                    )}
                    {(!currentUser || currentUser.role === 'admin' || currentUser.permissions?.includes('jobcards') || currentUser.permissions?.includes('jobcards_status_dashboard')) && (
                      <button onClick={() => { setActiveTab('jobcards_status_dashboard'); setMobileMenuOpen(false); }} className={`mobile-drawer-item ${(activeTab === 'jobcards_status_dashboard' || activeTab === 'jobcards_status') ? 'active' : ''}`}>
                        Pending Status Overview
                      </button>
                    )}
                    {(!currentUser || currentUser.role === 'admin' || currentUser.permissions?.includes('jobcards_printing_log')) && (
                      <button onClick={() => { setActiveTab('jobcards_printing_log'); setMobileMenuOpen(false); }} className={`mobile-drawer-item ${activeTab === 'jobcards_printing_log' ? 'active' : ''}`}>
                        Printing Department
                      </button>
                    )}
                    {(!currentUser || currentUser.role === 'admin' || currentUser.permissions?.includes('jobcards_fusing_log') || currentUser.permissions?.includes('jobcards')) && (
                      <button onClick={() => { setActiveTab('jobcards_fusing_log'); setMobileMenuOpen(false); }} className={`mobile-drawer-item ${activeTab === 'jobcards_fusing_log' ? 'active' : ''}`}>
                        Fusing Department
                      </button>
                    )}
                    {(!currentUser || currentUser.role === 'admin' || currentUser.permissions?.includes('jobcards_fabric')) && (
                      <button onClick={() => { setActiveTab('jobcards_fabric'); setMobileMenuOpen(false); }} className={`mobile-drawer-item ${activeTab === 'jobcards_fabric' ? 'active' : ''}`}>
                        Fabric Management
                      </button>
                    )}
                    {(!currentUser || currentUser.role === 'admin' || currentUser.permissions?.includes('jobcards_billing')) && (
                      <button onClick={() => { setActiveTab('jobcards_billing'); setMobileMenuOpen(false); }} className={`mobile-drawer-item ${activeTab === 'jobcards_billing' ? 'active' : ''}`}>
                        Finance
                      </button>
                    )}
                    {(!currentUser || currentUser.role === 'admin' || currentUser.permissions?.includes('jobcards_costing') || currentUser.permissions?.includes('jobcards_billing')) && (
                      <button onClick={() => { setActiveTab('jobcards_costing'); setMobileMenuOpen(false); }} className={`mobile-drawer-item ${activeTab === 'jobcards_costing' ? 'active' : ''}`}>
                        Costing
                      </button>
                    )}
                    {(!currentUser || currentUser.role === 'admin' || currentUser.permissions?.includes('jobcards_crm') || currentUser.permissions?.includes('crm_department') || currentUser.permissions?.includes('crm')) && (
                      <button onClick={() => { setActiveTab('jobcards_crm'); setMobileMenuOpen(false); }} className={`mobile-drawer-item ${activeTab === 'jobcards_crm' ? 'active' : ''}`}>
                        CRM Department
                      </button>
                    )}
                    {(!currentUser || currentUser.role === 'admin' || currentUser.permissions?.includes('jobcards_list')) && (
                      <button onClick={() => { setActiveTab('jobcards_list'); setMobileMenuOpen(false); }} className={`mobile-drawer-item ${activeTab === 'jobcards_list' ? 'active' : ''}`}>
                        Job Card
                      </button>
                    )}
                    {(!currentUser || currentUser.role === 'admin' || currentUser.permissions?.includes('jobcards_catalogue') || currentUser.permissions?.includes('jobcards_master') || currentUser.permissions?.includes('jobcards_sample')) && (
                      <button onClick={() => { setActiveTab('jobcards_catalogue'); setMobileMenuOpen(false); }} className={`mobile-drawer-item ${(activeTab === 'jobcards_catalogue' || activeTab === 'jobcards_master' || activeTab === 'jobcards_sample') ? 'active' : ''}`}>
                        Design Catalog
                      </button>
                    )}
                    {(!currentUser || currentUser.role === 'admin' || currentUser.permissions?.includes('designer_screen') || currentUser.permissions?.includes('designer_module') || currentUser.permissions?.includes('jobcards_sample')) && (
                      <button onClick={() => { setActiveTab('designer_screen'); setMobileMenuOpen(false); }} className={`mobile-drawer-item ${(activeTab === 'designer_screen' || activeTab === 'jobcards_sample') ? 'active' : ''}`}>
                        Designer Screen
                      </button>
                    )}
                    {(!currentUser || currentUser.role === 'admin' || currentUser.permissions?.includes('jobcards_settings')) && (
                      <button onClick={() => { setActiveTab('jobcards_settings'); setMobileMenuOpen(false); }} className={`mobile-drawer-item ${activeTab === 'jobcards_settings' ? 'active' : ''}`}>
                        Print Settings
                      </button>
                    )}
                    {(!currentUser || currentUser.role === 'admin' || currentUser.permissions?.includes('jobcards_complain') || currentUser.permissions?.includes('jobcards_complaints') || currentUser.permissions?.includes('complaint_dashboard') || currentUser.permissions?.includes('complaint_create')) && (
                      <button onClick={() => { setActiveTab('jobcards_complain'); setMobileMenuOpen(false); }} className={`mobile-drawer-item ${activeTab === 'jobcards_complain' ? 'active' : ''}`}>
                        Complaints
                      </button>
                    )}
                  </>
                ) : (
                  <>
                    {(!currentUser || isSuperOrAdmin || currentUser.role === 'admin' || currentUser.permissions?.includes('dashboard') || currentUser.permissions?.includes('elite_online')) && (
                      <button onClick={() => { setActiveTab('dashboard'); setMobileMenuOpen(false); }} className={`mobile-drawer-item ${activeTab === 'dashboard' ? 'active' : ''}`}>
                        Dashboard Overview
                      </button>
                    )}
                    {(!currentUser || isSuperOrAdmin || currentUser.role === 'admin' || currentUser.permissions?.includes('inventory')) && (
                      <button onClick={() => { setActiveTab('inventory'); setMobileMenuOpen(false); }} className={`mobile-drawer-item ${activeTab === 'inventory' ? 'active' : ''}`}>
                        Store Inventory
                      </button>
                    )}
                    {(!currentUser || isSuperOrAdmin || currentUser.role === 'admin' || currentUser.permissions?.includes('returns')) && (
                      <button onClick={() => { setActiveTab('returns'); setMobileMenuOpen(false); }} className={`mobile-drawer-item ${activeTab === 'returns' ? 'active' : ''}`}>
                        Returns Department
                      </button>
                    )}
                    {(!currentUser || isSuperOrAdmin || currentUser.role === 'admin' || currentUser.permissions?.includes('sales')) && (
                      <button onClick={() => { setActiveTab('sales'); setMobileMenuOpen(false); }} className={`mobile-drawer-item ${activeTab === 'sales' ? 'active' : ''}`}>
                        Sales Orders
                      </button>
                    )}
                    <button onClick={() => { setActiveTab('eo_complaints'); setMobileMenuOpen(false); }} className={`mobile-drawer-item ${activeTab === 'eo_complaints' ? 'active' : ''}`}>
                      Complaints
                    </button>
                    {(!currentUser || isSuperOrAdmin || currentUser.role === 'admin' || currentUser.permissions?.includes('reports')) && (
                      <button onClick={() => { setActiveTab('reports'); setMobileMenuOpen(false); }} className={`mobile-drawer-item ${activeTab === 'reports' ? 'active' : ''}`}>
                        Reports Center
                      </button>
                    )}
                    {(!currentUser || isSuperOrAdmin || currentUser.role === 'admin' || currentUser.permissions?.includes('eo_settings')) && (
                      <button onClick={() => { setActiveTab('eo_settings'); setMobileMenuOpen(false); }} className={`mobile-drawer-item ${activeTab === 'eo_settings' ? 'active' : ''}`}>
                        Settings
                      </button>
                    )}
                  </>
                )}

                {currentUser && (isSuperOrAdmin || currentUser.role === 'admin') && (
                  <button onClick={() => { setActiveTab('admin'); setMobileMenuOpen(false); }} className={`mobile-drawer-item ${activeTab === 'admin' ? 'active' : ''}`}>
                    Admin Panel
                  </button>
                )}
              </div>
            </div>

            {/* Section 3: User Info, Alerts, Refresh, and Sign Out */}
            <div style={{ marginTop: 'auto', paddingTop: '12px', borderTop: '1px solid var(--border-color)', display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: 'var(--font-size-meta, 0.75rem)', color: 'var(--text-muted)' }}>
                  User: {currentUser?.name} ({currentUser?.role || 'user'})
                </span>
              </div>
              {deferredInstallPrompt && !isStandalone && (
                <button
                  onClick={() => {
                    handleInstallClick();
                    setMobileMenuOpen(false);
                  }}
                  className="btn-primary btn-mobile-full"
                  style={{ minHeight: '44px', fontWeight: 600 }}
                >
                  Install App
                </button>
              )}
              <button
                onClick={() => {
                  fetchData();
                  triggerGlobalDataRefresh();
                  setMobileMenuOpen(false);
                  if (typeof window !== 'undefined' && window.showToast) {
                    window.showToast('Data refreshed', 'info');
                  }
                }}
                className="btn-secondary btn-mobile-full"
                style={{ minHeight: '44px' }}
              >
                Refresh Data
              </button>
              <button
                onClick={() => { setShowNotificationDrawer(true); setMobileMenuOpen(false); }}
                className="btn-secondary btn-mobile-full"
                style={{ minHeight: '44px' }}
              >
                Alerts {unreadNotifCount > 0 ? `(${unreadNotifCount})` : ''}
              </button>
              <button
                onClick={handleLogout}
                className="btn-danger btn-mobile-full"
                style={{ minHeight: '44px' }}
              >
                Sign Out
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Main Layout */}
      <main style={styles.mainLayout} className={`main-layout-container ${['communication', 'workspace', 'task_management'].includes(activeTab) ? 'is-comm-active' : ''}`}>
        
        {/* Left Navigation Sidebar - Hidden on Chat and Task Management */}
        {!['communication', 'workspace', 'task_management'].includes(activeTab) && (
        <aside
          style={{
            width: isSidebarCollapsed ? '68px' : '230px',
            flexShrink: 0,
            display: 'flex',
            flexDirection: 'column',
            gap: '8px',
            transition: 'width 150ms ease'
          }}
          className="sidebar-wrap"
        >
          <div style={{ padding: '6px', display: 'flex', flexDirection: 'column', gap: '4px' }}>
            {/* Collapse / Expand Toggle Button Header */}
            <div style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: isSidebarCollapsed ? 'center' : 'space-between',
              padding: '6px 8px',
              borderBottom: '1px solid var(--border-color)',
              marginBottom: '4px'
            }}>
              {!isSidebarCollapsed && (
                <span style={{ fontSize: 'var(--font-size-meta, 0.75rem)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em', color: 'var(--text-muted)' }}>
                  Menu
                </span>
              )}
              <button
                type="button"
                onClick={toggleSidebarCollapse}
                title={isSidebarCollapsed ? "Expand Sidebar" : "Collapse Sidebar"}
                style={{
                  background: 'transparent',
                  border: 'none',
                  borderRadius: '4px',
                  padding: '4px',
                  color: 'var(--text-muted)',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  minHeight: 'auto'
                }}
              >
                {isSidebarCollapsed ? <PanelLeftOpen size={16} /> : <PanelLeftClose size={16} />}
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
                      className="sidebar-nav-collapsed-btn"
                      style={{
                        background: isActive ? '#eff6ff' : 'transparent',
                        border: 'none',
                        outline: 'none',
                        boxSizing: 'border-box',
                        width: '100%',
                        padding: '8px 4px',
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: '4px',
                        borderRadius: '6px',
                        color: isActive ? '#1d4ed8' : '#64748b',
                        cursor: 'pointer',
                        textAlign: 'center',
                        transition: 'all 0.15s ease',
                        borderLeft: isActive ? '3px solid #2563eb' : '3px solid transparent',
                        position: 'relative'
                      }}
                      onMouseEnter={e => {
                        if (!isActive) e.currentTarget.style.background = '#f8fafc';
                      }}
                      onMouseLeave={e => {
                        if (!isActive) e.currentTarget.style.background = 'transparent';
                      }}
                    >
                      <NavIcon
                        size={20}
                        color={customColor || (isActive ? '#2563eb' : '#64748b')}
                        style={{ flexShrink: 0 }}
                      />
                      <span
                        style={{
                          fontSize: '0.66rem',
                          fontWeight: isActive ? 700 : 500,
                          lineHeight: 1.15,
                          color: isActive ? '#1d4ed8' : '#64748b',
                          wordBreak: 'break-word',
                          maxWidth: '64px',
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
                      background: isActive ? '#eff6ff' : 'transparent',
                      border: 'none',
                      width: '100%',
                      padding: '8px 12px',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'flex-start',
                      gap: '10px',
                      borderRadius: '6px',
                      color: isActive ? '#1d4ed8' : '#334155',
                      fontSize: '0.86rem',
                      fontWeight: isActive ? '700' : '500',
                      cursor: 'pointer',
                      textAlign: 'left',
                      transition: 'all 0.15s ease',
                      borderLeft: isActive ? '3px solid #2563eb' : '3px solid transparent',
                      whiteSpace: 'nowrap',
                      overflow: 'hidden'
                    }}
                    onMouseEnter={e => {
                      if (!isActive) e.currentTarget.style.background = '#f8fafc';
                    }}
                    onMouseLeave={e => {
                      if (!isActive) e.currentTarget.style.background = 'transparent';
                    }}
                  >
                    <NavIcon size={17} color={customColor || (isActive ? '#2563eb' : '#64748b')} style={{ flexShrink: 0 }} />
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

              const allowedCompanyDepts = [];
              if (hasEliteOnlineAccess) allowedCompanyDepts.push('elite_online');
              if (hasDigitalPrintAccess) allowedCompanyDepts.push('digital_print');
              if (hasStitchingAccess) allowedCompanyDepts.push('stitching');
              if (hasEliteEditionAccess) allowedCompanyDepts.push('elite_edition');
              if (hasEliteFabtexAccess) allowedCompanyDepts.push('elite_fabtex');

              if (['workspace', 'communication', 'task_management'].includes(activeTab) || allowedCompanyDepts.length === 0) {
                return (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                    {renderSectionHeader('Workforce', MessageSquare)}
                    {hasCommunicationAccess && renderNavItem('communication', 'Communication', MessageSquare, null, 'Chat')}
                    {hasTaskAccess && renderNavItem('task_management', 'Tasks', CheckSquare, null, 'Tasks')}
                  </div>
                );
              }

              if (activeDepartment === 'elite_edition' && hasEliteEditionAccess) {
                return (
                  <>
                    {(!currentUser || currentUser.role === 'admin' || currentUser.permissions?.includes('ee_dashboard')) &&
                      renderNavItem('ee_dashboard', 'Dashboard', LayoutDashboard, null, 'Dashboard')
                    }
                    {(!currentUser || currentUser.role === 'admin' || currentUser.permissions?.includes('ee_invoices')) &&
                      renderNavItem('ee_invoices', 'Finance', Receipt, null, 'Finance')
                    }
                    {(!currentUser || currentUser.role === 'admin' || currentUser.permissions?.includes('ee_complaints')) &&
                      renderNavItem('ee_complaints', 'Complaints', AlertTriangle, null, 'Complaints')
                    }
                    {(!currentUser || currentUser.role === 'admin' || currentUser.permissions?.includes('ee_settings')) &&
                      renderNavItem('ee_settings', 'Settings', Settings, null, 'Settings')
                    }
                  </>
                );
              }

              if (activeDepartment === 'elite_fabtex' && hasEliteFabtexAccess) {
                return (
                  <>
                    {(!currentUser || currentUser.role === 'admin' || currentUser.permissions?.includes('ef_dashboard')) &&
                      renderNavItem('ef_dashboard', 'Dashboard', LayoutDashboard, null, 'Dashboard')
                    }
                    {(!currentUser || currentUser.role === 'admin' || currentUser.permissions?.includes('ef_invoices')) &&
                      renderNavItem('ef_invoices', 'Finance', Receipt, null, 'Finance')
                    }
                    {(!currentUser || currentUser.role === 'admin' || currentUser.permissions?.includes('ef_complaints')) &&
                      renderNavItem('ef_complaints', 'Complaints', AlertTriangle, null, 'Complaints')
                    }
                    {(!currentUser || currentUser.role === 'admin' || currentUser.permissions?.includes('ef_settings')) &&
                      renderNavItem('ef_settings', 'Settings', Settings, null, 'Settings')
                    }
                  </>
                );
              }

              if (activeDepartment === 'stitching') {
                return (
                  <>
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
                    {renderNavItem('es_complaints', 'Complaints', AlertTriangle, null, 'Complaints')}
                    {(!currentUser || currentUser.role === 'admin' || currentUser.permissions?.includes('jobcards_stitching_settings') || currentUser.permissions?.includes('stitching_settings') || currentUser.permissions?.includes('es_settings')) &&
                      renderNavItem('es_settings', 'Settings', Settings, null, 'Settings')
                    }
                  </>
                );
              }

              if (activeDepartment === 'digital_print') {
                return (
                  <>
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
                      renderNavItem('jobcards_billing', 'Finance', Receipt, null, 'Finance')
                    }
                    {(!currentUser || currentUser.role === 'admin' || currentUser.permissions?.includes('jobcards_costing') || currentUser.permissions?.includes('jobcards_billing')) &&
                      renderNavItem('jobcards_costing', 'Costing', TrendingUp, null, 'Costing')
                    }
                    {(!currentUser || currentUser.role === 'admin' || currentUser.permissions?.includes('jobcards_crm') || currentUser.permissions?.includes('crm_department') || currentUser.permissions?.includes('crm')) &&
                      renderNavItem('jobcards_crm', 'CRM Department', Users, null, 'CRM')
                    }
                    {(!currentUser || currentUser.role === 'admin' || currentUser.permissions?.includes('jobcards_business_connection') || currentUser.permissions?.includes('jobcards_master_ai') || currentUser.permissions?.includes('jobcards')) &&
                      renderNavItem('jobcards_business_connection', 'Business Connection', Users, null, 'Connections')
                    }

                    {(!currentUser || currentUser.role === 'admin' || currentUser.permissions?.includes('jobcards_list')) &&
                      renderNavItem('jobcards_list', 'Job Card', FileText, null, 'Job Card')
                    }
                    {(!currentUser || currentUser.role === 'admin' || currentUser.permissions?.includes('jobcards_catalogue') || currentUser.permissions?.includes('jobcards_master') || currentUser.permissions?.includes('jobcards_sample')) &&
                      renderNavItem('jobcards_catalogue', 'Design Catalog', BookOpen, null, 'Catalog')
                    }
                    {(!currentUser || currentUser.role === 'admin' || currentUser.permissions?.includes('designer_screen') || currentUser.permissions?.includes('designer_module') || currentUser.permissions?.includes('jobcards_sample')) &&
                      renderNavItem('designer_screen', 'Designer Screen', Palette, null, 'Designer')
                    }
                    {(!currentUser || currentUser.role === 'admin' || currentUser.permissions?.includes('jobcards_settings')) &&
                      renderNavItem('jobcards_settings', 'Print Settings', Settings, null, 'Settings')
                    }
                    {(!currentUser || currentUser.role === 'admin' || currentUser.permissions?.includes('jobcards_raw_materials')) &&
                      renderNavItem('jobcards_raw_materials', 'Raw Materials', ShoppingBag, null, 'Materials')
                    }
                    {(!currentUser || currentUser.role === 'admin' || currentUser.permissions?.includes('jobcards_complain') || currentUser.permissions?.includes('jobcards_complaints') || currentUser.permissions?.includes('complaint_dashboard') || currentUser.permissions?.includes('complaint_create')) &&
                      renderNavItem('jobcards_complain', 'Complain Module', AlertTriangle, null, 'Complain')
                    }
                    {(!currentUser || currentUser.role === 'admin' || currentUser.permissions?.includes('jobcards_qa') || currentUser.permissions?.includes('qa') || currentUser.permissions?.includes('jobcards')) &&
                      renderNavItem('jobcards_qa', 'QA & Quality Checking', ShieldCheck, null, 'QA Check')
                    }
                  </>
                );
              }

              return (
                <>
                  {(!currentUser || isSuperOrAdmin || currentUser.role === 'admin' || currentUser.permissions?.includes('dashboard') || currentUser.permissions?.includes('elite_online')) &&
                    renderNavItem('dashboard', 'Dashboard Overview', LayoutDashboard, null, 'Dashboard')
                  }
                  {(!currentUser || isSuperOrAdmin || currentUser.role === 'admin' || currentUser.permissions?.includes('inventory')) &&
                    renderNavItem('inventory', 'Store Inventory', Database, null, 'Inventory')
                  }
                  {(!currentUser || isSuperOrAdmin || currentUser.role === 'admin' || currentUser.permissions?.includes('returns')) &&
                    renderNavItem('returns', 'Returns Department', PackageMinus, null, 'Returns')
                  }
                  {(!currentUser || isSuperOrAdmin || currentUser.role === 'admin' || currentUser.permissions?.includes('sales')) &&
                    renderNavItem('sales', 'Sales Orders', ShoppingBag, null, 'Sales')
                  }
                  {renderNavItem('eo_complaints', 'Complaints', AlertTriangle, null, 'Complaints')}
                  {(!currentUser || isSuperOrAdmin || currentUser.role === 'admin' || currentUser.permissions?.includes('reports')) &&
                    renderNavItem('reports', 'Reports Center', BarChart3, null, 'Reports')
                  }
                  {(!currentUser || isSuperOrAdmin || currentUser.role === 'admin' || currentUser.permissions?.includes('unicommerce')) &&
                    renderNavItem('unicommerce', 'Uniware Integrations', RefreshCw, null, 'Uniware')
                  }
                  {(!currentUser || isSuperOrAdmin || currentUser.role === 'admin' || currentUser.permissions?.includes('myntra')) &&
                    renderNavItem('myntra', 'Myntra Integrations', ShoppingBag, null, 'Myntra')
                  }
                  {(!currentUser || isSuperOrAdmin || currentUser.role === 'admin' || currentUser.permissions?.includes('eo_settings')) &&
                    renderNavItem('eo_settings', 'Settings', Settings, null, 'Settings')
                  }
                </>
              );
            })()}

            {currentUser && (isSuperOrAdmin || currentUser.role === 'admin') && (
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
                    background: activeTab === 'admin' ? '#eff6ff' : 'transparent',
                    border: 'none',
                    width: '100%',
                    padding: '8px 12px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'flex-start',
                    gap: '10px',
                    borderRadius: '6px',
                    color: activeTab === 'admin' ? '#1d4ed8' : '#334155',
                    fontSize: '0.86rem',
                    fontWeight: activeTab === 'admin' ? '700' : '500',
                    cursor: 'pointer',
                    textAlign: 'left',
                    transition: 'all 0.15s ease',
                    borderLeft: activeTab === 'admin' ? '3px solid #2563eb' : '3px solid transparent',
                    borderTop: '1px solid var(--border-color)',
                    marginTop: '0.5rem',
                    paddingTop: '0.75rem',
                    whiteSpace: 'nowrap',
                    overflow: 'hidden'
                  }}
                >
                  <ShieldAlert size={17} color={activeTab === 'admin' ? '#2563eb' : '#64748b'} style={{ flexShrink: 0 }} />
                  <span>Admin Panel</span>
                </button>
              )
            )}

          </div>
        </aside>
        )}

        {/* Right Content Panel */}
        <section
          style={{
            ...styles.contentArea,
            ...(['communication', 'workspace', 'task_management'].includes(activeTab) ? {
              display: 'flex',
              flexDirection: 'column',
              height: '100%',
              minHeight: 0,
              maxHeight: '100%',
              overflow: 'hidden',
              padding: 0
            } : {})
          }}
          className={['communication', 'workspace', 'task_management'].includes(activeTab) ? 'content-area-comm' : 'content-area-wrap'}
        >
          {error && <div style={styles.globalError}>{error}</div>}

          {!['communication', 'workspace', 'task_management'].includes(activeTab) && (
            <ErrorBoundary>
            <PullToRefresh onRefresh={async () => { await fetchData(); triggerGlobalDataRefresh(); }}>
            <Suspense fallback={<DashboardSkeleton />}>

            {activeTab === 'dashboard' || activeTab === 'elite_online' ? (
              <DashboardStats items={items} sales={sales} />
          ) : activeTab === 'eo_settings' ? (
            <CompanySettingsPanel companyEntity="Elite Online" />
          ) : activeTab === 'inventory' ? (
            <InventoryGrid
              items={items}
              catalogItems={catalogItems}
              onAdd={triggerAddModal}
              onEdit={triggerEditModal}
              onDelete={handleDeleteItem}
              onStockOut={triggerStockOutModal}
              onOpenManager={(tab) => triggerManagerModal(tab || 'brands')}
              onBulkInward={() => setIsBulkInwardOpen(true)}
              onQuickStockUpdate={handleQuickStockUpdate}
              onSyncCatalog={handleSyncCatalog}
              initialSubTab="overview"
            />
          ) : activeTab === 'catalog' ? (
            <InventoryGrid
              items={items}
              catalogItems={catalogItems}
              onAdd={triggerAddModal}
              onEdit={triggerEditModal}
              onDelete={handleDeleteItem}
              onStockOut={triggerStockOutModal}
              onOpenManager={(tab) => triggerManagerModal(tab || 'brands')}
              onBulkInward={() => setIsBulkInwardOpen(true)}
              onQuickStockUpdate={handleQuickStockUpdate}
              onSyncCatalog={handleSyncCatalog}
              initialSubTab="catalog"
            />
          ) : activeTab === 'returns' ? (
            <ReturnsManager />
          ) : activeTab === 'sales' ? (
            <SalesGrid />
          ) : activeTab === 'reports' ? (
            <ReportsCenter department={activeDepartment === 'elite_online' ? 'elite-online' : 'elite-print'} />
          ) : activeTab === 'jobcards_crm' || activeTab === 'crm_department' || activeTab === 'crm' || activeTab === 'crm_profiles' || activeTab === 'crm_leads' ? (
            <CrmPanel currentUser={currentUser} initialSubTab={activeTab === 'crm_profiles' ? 'profiles' : 'leads'} />
          ) : activeTab === 'jobcards_business_connection' || activeTab === 'jobcards_master_ai' || activeTab === 'master_ai_agent' || activeTab === 'business_connection' ? (
            <BusinessConnectionPanel currentUser={currentUser} />
          ) : activeTab.startsWith('jobcards') ? (
            <JobCardPanel currentUser={currentUser} activeSubTab={activeTab === 'jobcards' ? 'jobcards' : activeTab.replace('jobcards_', '')} department={activeDepartment} />
          ) : activeTab === 'ee_dashboard' ? (
            <CompanyDedicatedDashboard companyEntity="Elite Edition" onNavigate={(tab) => setActiveTab(tab)} />
          ) : activeTab === 'ee_settings' ? (
            <CompanySettingsPanel companyEntity="Elite Edition" />
          ) : activeTab === 'ee_complaints' ? (
            <DigitalPrintComplainModule companyEntity="Elite Edition" />
          ) : activeTab === 'ee_expenses' ? (
            <DigitalPrintExpenseModule companyEntity="Elite Edition" />
          ) : activeTab === 'ee_invoices' ? (
            <EliteBillingDepartment companyEntity="Elite Edition" />
          ) : activeTab === 'ef_dashboard' ? (
            <CompanyDedicatedDashboard companyEntity="Elite Fabtex" onNavigate={(tab) => setActiveTab(tab)} />
          ) : activeTab === 'ef_settings' ? (
            <CompanySettingsPanel companyEntity="Elite Fabtex" />
          ) : activeTab === 'ef_complaints' ? (
            <DigitalPrintComplainModule companyEntity="Elite Fabtex" />
          ) : activeTab === 'ef_expenses' ? (
            <DigitalPrintExpenseModule companyEntity="Elite Fabtex" />
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
          ) : activeTab === 'es_expenses' ? (
            <DigitalPrintExpenseModule companyEntity="Elite Stitching" />
          ) : activeTab === 'eo_complaints' ? (
            <DigitalPrintComplainModule companyEntity="Elite Online" />
          ) : activeTab === 'eo_expenses' ? (
            <DigitalPrintExpenseModule companyEntity="Elite Online" />
          ) : activeTab === 'expense_dashboard' || activeTab === 'expense_create' || activeTab === 'expenses' ? (
            <DigitalPrintExpenseModule companyEntity="Elite Digital Print" autoOpenCreate={activeTab === 'expense_create'} />
          ) : activeTab === 'unicommerce' ? (
            <UnicommerceHub />
          ) : activeTab === 'myntra' ? (
            <MyntraHub />
          ) : activeTab === 'designer_screen' || activeTab === 'designer_module' || activeTab === 'designer' ? (
            <DesignerScreen currentUser={currentUser} isAdmin={currentUser?.role === 'admin'} onNavigate={(t) => setActiveTab(t)} />
          ) : activeTab === 'admin' ? (
            <AdminPanel />
          ) : activeTab === 'no-access' ? (
            <div style={styles.noAccessContainer}>
              <ShieldAlert size={48} color="var(--primary)" />
              <h3 style={{ marginTop: '1rem', color: 'var(--text-primary)' }}>Access Restricted</h3>
              <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', marginTop: '0.5rem', textAlign: 'center' }}>
                You do not have permission to view this screen. Please contact your system administrator.
              </p>
            </div>
          ) : activeDepartment === 'elite_edition' && hasEliteEditionAccess ? (
            <CompanyDedicatedDashboard companyEntity="Elite Edition" onNavigate={(tab) => setActiveTab(tab)} />
          ) : activeDepartment === 'elite_fabtex' && hasEliteFabtexAccess ? (
            <CompanyDedicatedDashboard companyEntity="Elite Fabtex" onNavigate={(tab) => setActiveTab(tab)} />
          ) : activeDepartment === 'stitching' && hasStitchingAccess ? (
            <GarmentJobCardDashboard />
          ) : activeDepartment === 'digital_print' && hasDigitalPrintAccess ? (
            <JobCardPanel currentUser={currentUser} activeSubTab={getFirstJobCardsTab().replace('jobcards_', '')} department={activeDepartment} />
          ) : activeDepartment === 'elite_online' && hasEliteOnlineAccess ? (
            <DashboardStats items={items} sales={sales} />
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
          </PullToRefresh>
          </ErrorBoundary>
          )}

          {/* Persistent CommunicationPanel (Chat & Task Manager - preserved across tab navigation) */}
          <div style={{ display: (activeTab === 'communication' || activeTab === 'task_management' || activeTab === 'workspace') ? 'flex' : 'none', flex: 1, minHeight: 0, height: '100%', flexDirection: 'column' }}>
            <CommunicationPanel
              currentUser={currentUser}
              initialMainTab={activeTab === 'task_management' ? 'task' : 'chat'}
              activeTab={activeTab}
              onNavigateTab={(tab) => setActiveTab(tab)}
              onUnreadChange={(count) => setChatUnreadCount(count)}
            />
          </div>
        </section>
      </main>

      {/* Global Incoming Call Banner (Displayed on ANY page across ERP) */}
      {globalIncomingCall && (
        <div style={{
          position: 'fixed',
          top: '20px',
          left: '50%',
          transform: 'translateX(-50%)',
          zIndex: 999999,
          background: 'linear-gradient(135deg, rgba(15, 23, 42, 0.96), rgba(30, 41, 59, 0.98))',
          backdropFilter: 'blur(20px)',
          border: '1px solid rgba(56, 189, 248, 0.5)',
          boxShadow: '0 20px 45px -10px rgba(0,0,0,0.8), 0 0 35px rgba(56, 189, 248, 0.35)',
          borderRadius: '24px',
          padding: '16px 24px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '20px',
          minWidth: '380px',
          maxWidth: '92vw',
          animation: 'bannerSlideDown 0.35s cubic-bezier(0.16, 1, 0.3, 1)'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
            <div style={{
              width: '48px',
              height: '48px',
              borderRadius: '50%',
              background: 'linear-gradient(135deg, #0284c7, #2563eb)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#ffffff',
              boxShadow: '0 0 20px rgba(37, 99, 235, 0.6)'
            }}>
              <Phone size={22} />
            </div>
            <div>
              <div style={{ fontSize: '1rem', fontWeight: 800, color: '#ffffff', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span>{globalIncomingCall.callerName || 'Team Member'}</span>
                <span style={{ fontSize: '0.72rem', background: 'rgba(56, 189, 248, 0.2)', color: '#38bdf8', padding: '2px 8px', borderRadius: '12px' }}>
                  {globalIncomingCall.callType === 'video' ? 'Video Call' : 'Voice Call'}
                </span>
              </div>
              <div style={{ fontSize: '0.8rem', color: '#94a3b8', marginTop: '2px' }}>
                Incoming call on ERP Communication...
              </div>
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <button
              type="button"
              onClick={() => {
                const callData = globalIncomingCall;
                setGlobalIncomingCall(null);
                if (socket && callData.roomId) {
                  socket.emit('decline-call', {
                    roomId: callData.roomId,
                    caller: callData.caller,
                    decliner: currentUser?._id || currentUser?.id
                  });
                }
              }}
              style={{
                background: '#ef4444',
                color: '#ffffff',
                border: 'none',
                borderRadius: '12px',
                padding: '10px 18px',
                fontWeight: 700,
                fontSize: '0.84rem',
                cursor: 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px'
              }}
            >
              <PhoneOff size={16} />
              <span>Decline</span>
            </button>
            <button
              type="button"
              onClick={() => {
                const callData = globalIncomingCall;
                setGlobalIncomingCall(null);
                setActiveTab('communication');
                setTimeout(() => {
                  window.dispatchEvent(new CustomEvent('elite-answer-call', { detail: callData }));
                }, 200);
              }}
              style={{
                background: '#22c55e',
                color: '#ffffff',
                border: 'none',
                borderRadius: '12px',
                padding: '10px 20px',
                fontWeight: 800,
                fontSize: '0.84rem',
                cursor: 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                boxShadow: '0 4px 14px rgba(34, 197, 94, 0.4)'
              }}
            >
              <Phone size={16} />
              <span>Answer</span>
            </button>
          </div>
        </div>
      )}


      {/* Minimal Record Conflict Notice (No overwrite of unsaved form inputs) */}
      {conflictRecord && (
        <div
          data-testid="conflict-notice-banner"
          style={{
            position: 'fixed',
            top: 14,
            right: 14,
            backgroundColor: '#0f172a',
            color: '#e2e8f0',
            border: '1px solid #475569',
            padding: '8px 12px',
            borderRadius: '4px',
            fontSize: '12px',
            fontWeight: 500,
            zIndex: 100000,
            display: 'flex',
            alignItems: 'center',
            gap: '10px',
            boxShadow: '0 4px 12px rgba(0,0,0,0.3)'
          }}
        >
          <span>Updated by another user</span>
          <button
            onClick={() => {
              setConflictRecord(null);
              setEditingItem(null);
              triggerGlobalDataRefresh('conflict-reload');
            }}
            style={{
              backgroundColor: '#334155',
              color: '#f8fafc',
              border: 'none',
              borderRadius: '3px',
              padding: '3px 8px',
              fontSize: '11px',
              cursor: 'pointer'
            }}
          >
            Reload
          </button>
        </div>
      )}

      {/* Global Push / Toast Notifications Container */}
      <NotificationToastContainer toasts={toasts} setToasts={setToasts} />

      {/* Notification History Drawer */}
      <NotificationHistoryDrawer
        isOpen={showNotificationDrawer}
        onClose={() => setShowNotificationDrawer(false)}
        onSelectTab={(tab) => setActiveTab(tab)}
      />

      {/* Modal Dialogs with Deferred Suspense Loading */}
      <Suspense fallback={null}>
        {isFormOpen && (
          <InventoryForm
            item={editingItem}
            isCatalog={formMode === 'catalog'}
            onSubmit={editingItem ? handleEditSubmit : handleAddSubmit}
            onClose={() => {
              setIsFormOpen(false);
              setEditingItem(null);
              restoreSavedScrollPos();
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
              restoreSavedScrollPos();
            }}
          />
        )}

        {isManagerOpen && (
          <CatalogManagerModal
            initialTab={managerTab}
            onClose={() => {
              setIsManagerOpen(false);
              fetchData().finally(() => {
                restoreSavedScrollPos();
              });
              restoreSavedScrollPos();
            }}
          />
        )}

        {isBulkInwardOpen && (
          <BulkInwardModal
            onSubmit={handleBulkInwardSubmit}
            onClose={() => {
              setIsBulkInwardOpen(false);
              restoreSavedScrollPos();
            }}
          />
        )}
      </Suspense>

      {/* Content-Shaped Skeleton Screen for Initial Database Load */}
      {loading && items.length === 0 && sales.length === 0 && (
        <div style={{ ...styles.loadingOverlay, backgroundColor: 'var(--bg-main, #f8fafc)', padding: '16px', overflowY: 'auto' }}>
          <DashboardSkeleton />
        </div>
      )}
      {/* ── MOBILE QUICK COMPANY SWITCHER SHEET (Option 1 & 3 Combined) ── */}
      {showCompanyQuickSheet && (
        <div
          onClick={() => setShowCompanyQuickSheet(false)}
          style={{
            position: 'fixed',
            top: 0, left: 0, right: 0, bottom: 0,
            background: 'rgba(15, 23, 42, 0.75)',
            backdropFilter: 'blur(6px)',
            zIndex: 9999,
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'flex-end'
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              background: '#ffffff',
              borderTopLeftRadius: '22px',
              borderTopRightRadius: '22px',
              padding: '1.25rem 1.25rem 2.25rem 1.25rem',
              boxShadow: '0 -10px 40px rgba(0,0,0,0.3)',
              borderTop: '1px solid #e2e8f0',
              display: 'flex',
              flexDirection: 'column',
              gap: '1rem',
              maxHeight: '85vh',
              overflowY: 'auto'
            }}
          >
            {/* Drag Handle Indicator */}
            <div style={{ width: '42px', height: '4px', background: '#cbd5e1', borderRadius: '2px', alignSelf: 'center', marginBottom: '0.15rem' }} />

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <h3 style={{ fontSize: '1.15rem', fontWeight: 800, color: '#0f172a', margin: 0 }}>
                  🏢 Switch Active Company
                </h3>
                <span style={{ fontSize: '0.78rem', color: '#64748b' }}>
                  Tap any company to switch workspace instantly
                </span>
              </div>
              <button
                onClick={() => setShowCompanyQuickSheet(false)}
                style={{ background: 'none', border: 'none', fontSize: '1.2rem', cursor: 'pointer', color: '#64748b', padding: '0.2rem' }}
              >
                ✕
              </button>
            </div>

            {/* List of Companies */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.65rem', marginTop: '0.25rem' }}>
              {COMPANIES.map(company => {
                if (!isCompanyAllowed(company.id) && !isCompanyAllowed(company.name)) return null;
                if (company.id === 'elite_online' && !hasEliteOnlineAccess) return null;
                if (company.id === 'digital_print' && !hasDigitalPrintAccess) return null;
                if (company.id === 'stitching' && !hasStitchingAccess) return null;
                if (company.id === 'elite_edition' && !hasEliteEditionAccess) return null;
                if (company.id === 'elite_fabtex' && !hasEliteFabtexAccess) return null;

                const isActive = activeDepartment === company.id && activeTab !== 'workspace';
                const CompIcon = company.iconName === 'Store' ? Store : company.iconName === 'Printer' ? Printer : company.iconName === 'Scissors' ? Scissors : company.iconName === 'Layers' ? Layers : Building;
                const brandColor = company.iconColor || '#6366f1';

                return (
                  <div
                    key={company.id}
                    onClick={() => {
                      handleSwitchDepartment(company.id);
                      setShowCompanyQuickSheet(false);
                      setMobileMenuOpen(false);
                    }}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      padding: '0.85rem 1rem',
                      borderRadius: '14px',
                      border: isActive ? `2px solid ${brandColor}` : '1px solid #e2e8f0',
                      background: isActive ? `${brandColor}0d` : '#ffffff',
                      cursor: 'pointer',
                      boxShadow: isActive ? `0 4px 14px ${brandColor}35` : '0 1px 3px rgba(0,0,0,0.03)',
                      transition: 'all 0.15s ease'
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.85rem' }}>
                      <div style={{
                        width: '42px',
                        height: '42px',
                        borderRadius: '12px',
                        background: company.gradient || 'linear-gradient(135deg, #6366f1, #0891b2)',
                        color: '#ffffff',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        flexShrink: 0,
                        boxShadow: `0 3px 10px ${brandColor}40`
                      }}>
                        <CompIcon size={20} color="#ffffff" />
                      </div>
                      <div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem' }}>
                          <span style={{ fontSize: '0.95rem', fontWeight: 800, color: '#0f172a' }}>
                            {company.name}
                          </span>
                          <span style={{
                            fontSize: '0.68rem',
                            fontWeight: 800,
                            padding: '2px 6px',
                            borderRadius: '6px',
                            background: `${brandColor}18`,
                            color: brandColor,
                            border: `1px solid ${brandColor}30`
                          }}>
                            {company.code}
                          </span>
                        </div>
                        <div style={{ fontSize: '0.76rem', color: '#64748b', fontWeight: 600, marginTop: '2px' }}>
                          {company.type}
                        </div>
                      </div>
                    </div>

                    {isActive ? (
                      <span style={{
                        padding: '0.28rem 0.75rem',
                        borderRadius: '20px',
                        background: brandColor,
                        color: '#ffffff',
                        fontSize: '0.75rem',
                        fontWeight: 800,
                        boxShadow: `0 2px 8px ${brandColor}50`
                      }}>
                        Active ✓
                      </span>
                    ) : (
                      <ChevronRight size={18} color="#94a3b8" />
                    )}
                  </div>
                );
              })}

              {hasWorkspaceAccess && (
                <div
                  onClick={() => {
                    setActiveTab('communication');
                    setShowCompanyQuickSheet(false);
                    setMobileMenuOpen(false);
                    if (typeof window !== 'undefined') {
                      window.dispatchEvent(new CustomEvent('elite-open-chat-list'));
                    }
                  }}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '0.85rem 1rem',
                    borderRadius: '14px',
                    border: (activeTab === 'communication' || activeTab === 'workspace') ? '2px solid #2563eb' : '1px solid #e2e8f0',
                    background: (activeTab === 'communication' || activeTab === 'workspace') ? '#eff6ff' : '#ffffff',
                    cursor: 'pointer',
                    boxShadow: (activeTab === 'communication' || activeTab === 'workspace') ? '0 4px 14px rgba(37,99,235,0.25)' : '0 1px 3px rgba(0,0,0,0.03)',
                    transition: 'all 0.15s ease'
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.85rem' }}>
                    <div style={{
                      width: '42px',
                      height: '42px',
                      borderRadius: '12px',
                      background: 'linear-gradient(135deg, #38bdf8 0%, #2563eb 100%)',
                      color: '#ffffff',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      flexShrink: 0,
                      boxShadow: '0 3px 10px rgba(37,99,235,0.4)'
                    }}>
                      <MessageSquare size={20} color="#ffffff" />
                    </div>
                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem' }}>
                        <span style={{ fontSize: '0.95rem', fontWeight: 800, color: '#0f172a' }}>
                          Inter-Dept Communication
                        </span>
                        <span style={{ fontSize: '0.68rem', fontWeight: 800, padding: '2px 6px', borderRadius: '6px', background: '#eff6ff', color: '#2563eb', border: '1px solid #bfdbfe' }}>
                          CHAT &amp; TASKS
                        </span>
                        {chatUnreadCount > 0 && (
                          <span style={{
                            background: '#ef4444',
                            color: '#ffffff',
                            borderRadius: '10px',
                            minWidth: '18px',
                            height: '18px',
                            fontSize: '0.62rem',
                            fontWeight: 900,
                            display: 'inline-flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            padding: '0 5px'
                          }}>
                            {chatUnreadCount > 99 ? '99+' : chatUnreadCount}
                          </span>
                        )}
                      </div>
                      <div style={{ fontSize: '0.76rem', color: '#64748b', fontWeight: 600, marginTop: '2px' }}>
                        Real-time Team Chat, Channels &amp; Task Stream
                      </div>
                    </div>
                  </div>
                  {(activeTab === 'communication' || activeTab === 'workspace') ? (
                    <span style={{ padding: '0.28rem 0.75rem', borderRadius: '20px', background: '#2563eb', color: '#ffffff', fontSize: '0.75rem', fontWeight: 800 }}>
                      Active ✓
                    </span>
                  ) : (
                    <ChevronRight size={18} color="#94a3b8" />
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Global Elite Glassmorphic Modal Dialog */}
      <EliteModalDialog />

      {/* Global In-App PDF Preview & Share Modal */}
      <PdfPreviewModal />

      {/* Global Print Setup & Media Options Modal */}
      <PrintOptionsModal />


      {/* Zero-Hard-Refresh Hot Update Notification */}
      <AutoUpdateNotification />

      {/* Hardware & Web Device Permissions Hub Modal */}
      <WebDevicePermissionsModal
        isOpen={showPermissionsModal}
        onClose={() => setShowPermissionsModal(false)}
        currentUser={currentUser}
      />

      {/* Browser Permissions Unblock Guide Modal */}
      <PermissionHelpModal
        isOpen={showPermHelpModal}
        onClose={() => setShowPermHelpModal(false)}
        onOpenDeviceHub={() => setShowPermissionsModal(true)}
      />

      {/* Global AI Textile Measurement & Yield Agent Modal */}
      {globalAiMeasurement.isOpen && (
        <AIMeasurementAgentModal
          isOpen={globalAiMeasurement.isOpen}
          onClose={() => setGlobalAiMeasurement({ isOpen: false, initialData: {}, onApply: null })}
          initialData={globalAiMeasurement.initialData}
          onApply={globalAiMeasurement.onApply}
        />
      )}

      {/* Mobile Bottom Navigation (Company-Specific Quick Screens, text only, safe-area inset) */}
      {isMobile && isAuthenticated && !['communication', 'workspace', 'task_management'].includes(activeTab) && (
        <MobileBottomNav
          activeDepartment={activeDepartment}
          activeTab={activeTab}
          onSelectTab={(tab) => {
            setActiveTab(tab);
            setMobileMenuOpen(false);
          }}
          onOpenMenu={() => setMobileMenuOpen(true)}
        />
      )}

      {/* Global Search Modal (Ctrl/Cmd+K) */}
      <GlobalSearchModal
        isOpen={showGlobalSearch}
        onClose={() => setShowGlobalSearch(false)}
        onSelectResult={handleSelectSearchResult}
        activeCompanyId={activeDepartment}
      />

      {/* Dynamic Multi-Entity Luminous Accent Perimeter */}
      <div className="entity-accent-perimeter" />

      {/* Global Ambient Hardware Barcode Sniffer HUD */}
      <BarcodeSnifferHUD onGlobalSearch={(q) => setShowGlobalSearch(true)} />

      {/* Zen / Focus Mode Controller & Floating Exit Pill (Alt + Z) */}
      <ZenFocusModeController />

      {/* Global Data Table Context Menu */}
      <TableContextMenu />

      {/* Keyboard Shortcuts Reference Dialog (? Drawer) */}
      <KeyboardShortcutModal />

      {/* Scroll-Triggered Sticky Drop-Shadows Tracker */}
      <StickyScrollShadowTracker />

      {/* Enterprise Industrial HUD Theme & UI Scale Controller */}
      <EnterpriseHUDThemeController />

      {/* Rotating Smart Tips Banner */}
      <QuickTipPill />

      {/* Guided Feature Tour Controller */}
      <GuidedTourController />

      {/* Undo Toast Container */}
      <UndoToastContainer />
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
    padding: 'var(--app-padding, 12px)',
    display: 'flex',
    flexDirection: 'column',
    gap: '12px',
    minHeight: '100dvh',
    width: '100%',
    overflowX: 'hidden',
    boxSizing: 'border-box',
  },
  header: {
    position: 'sticky',
    top: 0,
    zIndex: 1000,
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '8px 12px',
    borderBottom: '1px solid var(--border-color)',
    backgroundColor: 'var(--bg-card, #ffffff)',
    minHeight: '52px',
    boxShadow: 'none',
    width: '100%',
    boxSizing: 'border-box',
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
    /* gap is overridden by CSS class gap: 12px !important */
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
    minHeight: 0,
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
