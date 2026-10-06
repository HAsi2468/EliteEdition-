import React, { useState, useEffect } from 'react';
import { api } from '../services/api';
import { triggerPushNotification } from './NotificationToast';
import { matchSearchQuery } from '../utils/searchUtils';
import PrintSettings from './PrintSettings';
import {
  UserPlus,
  ShieldAlert,
  Key,
  Edit2,
  Trash2,
  Save,
  RotateCw,
  User,
  Check,
  X,
  Lock,
  Mail,
  Sliders,
  Coins,
  CreditCard,
  DollarSign,
  FileText,
  Database,
  Calendar,
  Layers,
  Download,
  FileSpreadsheet,
  Search,
  Settings,
  AlertCircle,
  FileCheck,
  Users,
  Palette,
  Eye,
  EyeOff,
  ShieldCheck,
  Sparkles,
  FilterX
} from 'lucide-react';
import { AVAILABLE_SCREENS } from '../config/screensConfig';
import AdminSignedDocumentsApproval from './AdminSignedDocumentsApproval';
import AdminClientDetails from './AdminClientDetails';
import AdminChangeApprovalQueue from './AdminChangeApprovalQueue';
import AdminUserDataReview from './AdminUserDataReview';


export default function AdminPanel() {
  const [users, setUsers] = useState([]);
  const [userSearch, setUserSearch] = useState('');
  const [selectedCompanyFilter, setSelectedCompanyFilter] = useState('All');
  const [selectedDeptFilter, setSelectedDeptFilter] = useState('All');
  const [selectedStatusFilter, setSelectedStatusFilter] = useState('All');
  const [loading, setLoading] = useState(false);
  const [submitLoading, setSubmitLoading] = useState(false);
  const [error, setError] = useState('');
  const [modalError, setModalError] = useState('');
  const [success, setSuccess] = useState('');

  // Mobile & iOS Viewport Detection
  const [isMobile, setIsMobile] = useState(
    typeof window !== 'undefined' ? window.innerWidth <= 768 : false
  );

  useEffect(() => {
    const handleResize = () => {
      setIsMobile(window.innerWidth <= 768);
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Sub Tab Navigation
  const [activeSubTab, setActiveSubTab] = useState('users'); // 'users', 'billing', 'backup', 'approvals'
  const [pendingApprovalsCount, setPendingApprovalsCount] = useState(0);
  const [bills, setBills] = useState([]);
  const [billsLoading, setBillsLoading] = useState(false);
  const [billFormData, setBillFormData] = useState({
    month: '',
    awsAmount: '',
    mongoDbAmount: '',
    notes: ''
  });
  const [editingBill, setEditingBill] = useState(null); // null means "Add Mode"

  // Data Backup Form State
  const [backupForm, setBackupForm] = useState({
    startDate: '',
    endDate: '',
    department: 'all',
    format: 'json'
  });
  const [backupLoading, setBackupLoading] = useState(false);

  // Form & Modal State
  const [showUserModal, setShowUserModal] = useState(false);
  const [editingUser, setEditingUser] = useState(null); // null means "Add Mode"
  const [modalTab, setModalTab] = useState('profile'); // 'profile', 'privileges', 'screens'
  const [showPassword, setShowPassword] = useState(false);
  const [availableDesigners, setAvailableDesigners] = useState([]);
  const [permissionSearchTerm, setPermissionSearchTerm] = useState('');
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    password: '',
    role: 'user',
    isMainAdmin: false,
    department: 'General',
    designerName: '',
    canManageTasks: true,
    canBroadcastChat: true,
    canExportReports: true,
    canDeleteRecords: true,
    canViewFinancials: true,
    canCreateJobCards: true,
    canEditJobCards: true,
    canDeleteJobCards: true,
    canAdvanceJobStage: true,
    canViewJobCosts: true,
    canCreateDesigns: true,
    canInputNewDesign: false,
    canEditDesigns: true,
    canDeleteDesigns: true,
    canViewDesignCosts: true,
    canAddFabricInward: true,
    canIssueFabricOutward: true,
    canTransferFabricLot: true,
    canDeleteFabricLogs: true,
    canViewFabricPrices: true,
    canCreateInvoices: true,
    canEditInvoiceRates: true,
    canCancelInvoices: true,
    canRecordPayments: true,
    canCreateStitchingJobs: true,
    canIssueStitchingChallans: true,
    canManageWorkerRates: true,
    allowedCompanies: ['Elite Online', 'Elite Digital Print', 'Elite Stitching', 'Elite Edition', 'Elite Fabtex'],
    permissions: []
  });

  const fetchBills = async () => {
    setBillsLoading(true);
    setError('');
    try {
      const res = await api.getInfraBills();
      if (res && res.success) {
        setBills(res.bills || []);
      }
    } catch (err) {
      setError(err.message || 'Failed to fetch billing records.');
    } finally {
      setBillsLoading(false);
    }
  };

  useEffect(() => {
    if (activeSubTab === 'billing') {
      fetchBills();
    }
  }, [activeSubTab]);

  useEffect(() => {
    api.getChangeApprovalStats().then(res => {
      if (res?.data?.pending !== undefined) {
        setPendingApprovalsCount(res.data.pending);
      }
    }).catch(() => {});
  }, [activeSubTab]);

  const handleBillSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    if (!billFormData.month.trim()) {
      setError('Month is required.');
      return;
    }

    setSubmitLoading(true);
    try {
      const payload = {
        month: billFormData.month.trim(),
        awsAmount: Number(billFormData.awsAmount || 0),
        mongoDbAmount: Number(billFormData.mongoDbAmount || 0),
        notes: (billFormData.notes || '').trim()
      };

      if (editingBill) {
        await api.updateInfraBill(editingBill._id || editingBill.id, payload);
        setSuccess(`Billing for "${billFormData.month}" updated successfully.`);
      } else {
        await api.createInfraBill(payload);
        setSuccess(`Billing for "${billFormData.month}" logged successfully.`);
      }

      handleCancelBillEdit();
      fetchBills();
    } catch (err) {
      setError(err.message || 'Failed to save billing record.');
    } finally {
      setSubmitLoading(false);
    }
  };

  const handleEditBillClick = (bill) => {
    setEditingBill(bill);
    setBillFormData({
      month: bill.month || '',
      awsAmount: bill.awsAmount !== undefined ? String(bill.awsAmount) : '',
      mongoDbAmount: bill.mongoDbAmount !== undefined ? String(bill.mongoDbAmount) : '',
      notes: bill.notes || ''
    });
    setError('');
    setSuccess('');
  };

  const handleCancelBillEdit = () => {
    setEditingBill(null);
    setBillFormData({
      month: '',
      awsAmount: '',
      mongoDbAmount: '',
      notes: ''
    });
    setError('');
    setSuccess('');
  };

  const handleDeleteBill = async (bill) => {
    if (!window.confirm(`Are you sure you want to delete the billing record for "${bill.month}"?`)) return;

    setError('');
    setSuccess('');
    try {
      await api.deleteInfraBill(bill._id || bill.id);
      setSuccess(`Billing for "${bill.month}" deleted successfully.`);
      fetchBills();
      if (editingBill && (editingBill._id === bill._id || editingBill.id === bill.id)) {
        handleCancelBillEdit();
      }
    } catch (err) {
      setError(err.message || 'Failed to delete billing record.');
    }
  };

  const handleDownloadBackup = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    setBackupLoading(true);
    try {
      await api.downloadDataBackup({
        startDate: backupForm.startDate,
        endDate: backupForm.endDate,
        department: backupForm.department,
        format: backupForm.format
      });
      setSuccess('Full data backup archive generated and downloaded successfully!');
      triggerPushNotification('Data Backup Complete', 'Backup file downloaded to your system.');
    } catch (err) {
      setError(err.message || 'Failed to generate data backup.');
    } finally {
      setBackupLoading(false);
    }
  };

  useEffect(() => {
    fetchUsers();
    api.getPrintConfig().then(cfg => {
      if (cfg && Array.isArray(cfg.designers)) {
        setAvailableDesigners(cfg.designers);
      }
    }).catch(() => {});
  }, []);

  const fetchUsers = async () => {
    setLoading(true);
    setError('');
    try {
      const res = await api.getUsers({ limit: 100 });
      if (res && res.users) {
        setUsers(res.users.rows || []);
      }
    } catch (err) {
      setError(err.message || 'Failed to fetch users list.');
    } finally {
      setLoading(false);
    }
  };

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const handleRoleChange = (e) => {
    const roleValue = e.target.value;
    setFormData(prev => ({
      ...prev,
      role: roleValue,
      permissions: roleValue === 'admin' ? AVAILABLE_SCREENS.map(s => s.id) : []
    }));
  };

  const handlePermissionCheckbox = (screenId) => {
    setFormData(prev => {
      const isChecked = prev.permissions.includes(screenId);
      let updatedPerms = [];
      if (isChecked) {
        updatedPerms = prev.permissions.filter(p => p !== screenId);
      } else {
        updatedPerms = [...prev.permissions, screenId];
      }
      const isGrantingDesignAccess = !isChecked && (
        screenId === 'jobcards_sample' ||
        screenId === 'designer_screen' ||
        screenId === 'jobcards_catalogue'
      );
      return {
        ...prev,
        permissions: updatedPerms,
        ...(isGrantingDesignAccess ? { canInputNewDesign: true, canCreateDesigns: true } : {})
      };
    });
  };

  const ALL_COMPANY_NAMES = ['Elite Online', 'Elite Digital Print', 'Elite Stitching', 'Elite Edition', 'Elite Fabtex'];
  const DEPARTMENTS_LIST = [
    'General',
    'Executive',
    'Production',
    'Fabric & Yarn',
    'Stitching & Cutting',
    'E-Commerce & Orders',
    'Billing & Accounts',
    'Inventory & Warehouse',
    'Customer Service'
  ];

  const applyRolePreset = (presetKey) => {
    if (presetKey === 'full_admin') {
      setFormData(prev => ({
        ...prev,
        role: 'admin',
        isMainAdmin: false,
        department: 'Executive',
        status: 'Active',
        allowedCompanies: ALL_COMPANY_NAMES,
        permissions: AVAILABLE_SCREENS.map(s => s.id),
        canManageTasks: true,
        canBroadcastChat: true,
        canExportReports: true,
        canDeleteRecords: true,
        canViewFinancials: true
      }));
    } else if (presetKey === 'executive') {
      setFormData(prev => ({
        ...prev,
        role: 'user',
        isMainAdmin: false,
        department: 'Executive',
        status: 'Active',
        allowedCompanies: ALL_COMPANY_NAMES,
        permissions: ['dashboard', 'interdept-communication', 'task-manager', 'expense-log', 'billing-invoice', 'data-backup'],
        canManageTasks: true,
        canBroadcastChat: true,
        canExportReports: true,
        canDeleteRecords: true,
        canViewFinancials: true
      }));
    } else if (presetKey === 'production_manager') {
      setFormData(prev => ({
        ...prev,
        role: 'user',
        isMainAdmin: false,
        department: 'Production',
        status: 'Active',
        allowedCompanies: ['Elite Edition', 'Elite Fabtex', 'Elite Stitching'],
        permissions: ['production-tracker', 'job-card-register', 'machine-workload', 'batch-process-entry', 'quality-check-log', 'raw-material-inward', 'inventory-grid'],
        canManageTasks: true,
        canBroadcastChat: true,
        canExportReports: true,
        canDeleteRecords: false,
        canViewFinancials: true
      }));
    } else if (presetKey === 'stitching_master') {
      setFormData(prev => ({
        ...prev,
        role: 'user',
        isMainAdmin: false,
        department: 'Stitching & Cutting',
        status: 'Active',
        allowedCompanies: ['Elite Stitching', 'Elite Edition'],
        permissions: ['stitching-job-slips', 'cutting-register', 'stitching-work-orders', 'worker-attendance-ledger', 'quality-check-log'],
        canManageTasks: true,
        canBroadcastChat: false,
        canExportReports: false,
        canDeleteRecords: false,
        canViewFinancials: false
      }));
    } else if (presetKey === 'ecommerce_manager') {
      setFormData(prev => ({
        ...prev,
        role: 'user',
        isMainAdmin: false,
        department: 'E-Commerce & Orders',
        status: 'Active',
        allowedCompanies: ['Elite Online', 'Elite Digital Print'],
        permissions: ['online-sales-orders', 'product-master-catalog', 'dispatch-courier-register', 'return-exchange-desk', 'myntra-order-sync', 'customer-complaint-center'],
        canManageTasks: true,
        canBroadcastChat: true,
        canExportReports: true,
        canDeleteRecords: false,
        canViewFinancials: true
      }));
    } else if (presetKey === 'billing_clerk') {
      setFormData(prev => ({
        ...prev,
        role: 'user',
        isMainAdmin: false,
        department: 'Billing & Accounts',
        status: 'Active',
        allowedCompanies: ALL_COMPANY_NAMES,
        permissions: ['billing-invoice', 'outward-billing-register', 'expense-log', 'cash-in-out-entry', 'vendor-ledger-master', 'party-customer-master'],
        canManageTasks: true,
        canBroadcastChat: false,
        canExportReports: true,
        canDeleteRecords: false,
        canViewFinancials: true
      }));
    } else if (presetKey === 'store_keeper') {
      setFormData(prev => ({
        ...prev,
        role: 'user',
        isMainAdmin: false,
        department: 'Inventory & Warehouse',
        status: 'Active',
        allowedCompanies: ['Elite Edition', 'Elite Fabtex', 'Elite Stitching'],
        permissions: ['inventory-grid', 'raw-material-inward', 'stock-outward-register', 'fabric-yarn-req'],
        canManageTasks: true,
        canBroadcastChat: false,
        canExportReports: true,
        canDeleteRecords: false,
        canViewFinancials: false
      }));
    }
  };

  const handleEditClick = (user) => {
    setEditingUser(user);
    setFormData({
      name: user.name || '',
      email: user.email || '',
      password: '',
      role: user.role || (user.permissions?.length === AVAILABLE_SCREENS.length ? 'admin' : 'user'),
      isMainAdmin: Boolean(user.isMainAdmin || user.email === 'harshitsidapara2468@gmail.com'),
      department: user.department || 'General',
      designerName: user.designerName || '',
      status: user.status || 'Active',
      canManageTasks: user.canManageTasks !== undefined ? Boolean(user.canManageTasks) : true,
      canBroadcastChat: user.canBroadcastChat !== undefined ? Boolean(user.canBroadcastChat) : true,
      canExportReports: user.canExportReports !== undefined ? Boolean(user.canExportReports) : true,
      canDeleteRecords: user.canDeleteRecords !== undefined ? Boolean(user.canDeleteRecords) : true,
      canViewFinancials: user.canViewFinancials !== undefined ? Boolean(user.canViewFinancials) : true,
      canCreateJobCards: user.canCreateJobCards !== undefined ? Boolean(user.canCreateJobCards) : true,
      canEditJobCards: user.canEditJobCards !== undefined ? Boolean(user.canEditJobCards) : true,
      canDeleteJobCards: user.canDeleteJobCards !== undefined ? Boolean(user.canDeleteJobCards) : true,
      canAdvanceJobStage: user.canAdvanceJobStage !== undefined ? Boolean(user.canAdvanceJobStage) : true,
      canViewJobCosts: user.canViewJobCosts !== undefined ? Boolean(user.canViewJobCosts) : true,
      canCreateDesigns: user.canCreateDesigns !== undefined ? Boolean(user.canCreateDesigns) : true,
      canInputNewDesign: user.canInputNewDesign !== undefined ? Boolean(user.canInputNewDesign) : false,
      canEditDesigns: user.canEditDesigns !== undefined ? Boolean(user.canEditDesigns) : true,
      canDeleteDesigns: user.canDeleteDesigns !== undefined ? Boolean(user.canDeleteDesigns) : true,
      canViewDesignCosts: user.canViewDesignCosts !== undefined ? Boolean(user.canViewDesignCosts) : true,
      canAddFabricInward: user.canAddFabricInward !== undefined ? Boolean(user.canAddFabricInward) : true,
      canIssueFabricOutward: user.canIssueFabricOutward !== undefined ? Boolean(user.canIssueFabricOutward) : true,
      canTransferFabricLot: user.canTransferFabricLot !== undefined ? Boolean(user.canTransferFabricLot) : true,
      canDeleteFabricLogs: user.canDeleteFabricLogs !== undefined ? Boolean(user.canDeleteFabricLogs) : true,
      canViewFabricPrices: user.canViewFabricPrices !== undefined ? Boolean(user.canViewFabricPrices) : true,
      canCreateInvoices: user.canCreateInvoices !== undefined ? Boolean(user.canCreateInvoices) : true,
      canEditInvoiceRates: user.canEditInvoiceRates !== undefined ? Boolean(user.canEditInvoiceRates) : true,
      canCancelInvoices: user.canCancelInvoices !== undefined ? Boolean(user.canCancelInvoices) : true,
      canRecordPayments: user.canRecordPayments !== undefined ? Boolean(user.canRecordPayments) : true,
      canCreateStitchingJobs: user.canCreateStitchingJobs !== undefined ? Boolean(user.canCreateStitchingJobs) : true,
      canIssueStitchingChallans: user.canIssueStitchingChallans !== undefined ? Boolean(user.canIssueStitchingChallans) : true,
      canManageWorkerRates: user.canManageWorkerRates !== undefined ? Boolean(user.canManageWorkerRates) : true,
      allowedCompanies: Array.isArray(user.allowedCompanies) && user.allowedCompanies.length > 0 ? user.allowedCompanies : ALL_COMPANY_NAMES,
      permissions: user.permissions || []
    });
    setError('');
    setModalError('');
    setSuccess('');
    setModalTab('profile');
    setShowPassword(false);
    setShowUserModal(true);
  };

  const handleCreateNewClick = () => {
    setEditingUser(null);
    setModalTab('profile');
    setShowPassword(false);
    setFormData({
      name: '',
      email: '',
      password: '',
      role: 'user',
      isMainAdmin: false,
      department: 'General',
      designerName: '',
      status: 'Active',
      canManageTasks: true,
      canBroadcastChat: true,
      canExportReports: true,
      canDeleteRecords: true,
      canViewFinancials: true,
      canCreateJobCards: true,
      canEditJobCards: true,
      canDeleteJobCards: true,
      canAdvanceJobStage: true,
      canViewJobCosts: true,
      canCreateDesigns: true,
      canInputNewDesign: false,
      canEditDesigns: true,
      canDeleteDesigns: true,
      canViewDesignCosts: true,
      canAddFabricInward: true,
      canIssueFabricOutward: true,
      canTransferFabricLot: true,
      canDeleteFabricLogs: true,
      canViewFabricPrices: true,
      canCreateInvoices: true,
      canEditInvoiceRates: true,
      canCancelInvoices: true,
      canRecordPayments: true,
      canCreateStitchingJobs: true,
      canIssueStitchingChallans: true,
      canManageWorkerRates: true,
      allowedCompanies: ALL_COMPANY_NAMES,
      permissions: []
    });
    setError('');
    setModalError('');
    setSuccess('');
    setShowUserModal(true);
  };

  const handleCancelEdit = () => {
    setEditingUser(null);
    setShowUserModal(false);
    setModalTab('profile');
    setShowPassword(false);
    setModalError('');
    setPermissionSearchTerm('');
    setFormData({
      name: '',
      email: '',
      password: '',
      role: 'user',
      isMainAdmin: false,
      department: 'General',
      designerName: '',
      status: 'Active',
      canManageTasks: true,
      canBroadcastChat: true,
      canExportReports: true,
      canDeleteRecords: true,
      canViewFinancials: true,
      allowedCompanies: ALL_COMPANY_NAMES,
      permissions: []
    });
    setError('');
    setSuccess('');
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setModalError('');
    setSuccess('');

    if (!formData.name.trim() || !formData.email.trim()) {
      const errText = 'Name and Email are required.';
      setError(errText);
      setModalError(errText);
      return;
    }

    if (!editingUser && !formData.password) {
      const errText = 'Password is required for new users.';
      setError(errText);
      setModalError(errText);
      return;
    }

    setSubmitLoading(true);
    try {
      if (editingUser) {
        const updatePayload = {
          name: formData.name.trim(),
          email: formData.email.trim(),
          role: formData.role,
          isMainAdmin: formData.isMainAdmin,
          department: formData.department,
          status: formData.status,
          canManageTasks: formData.canManageTasks,
          canBroadcastChat: formData.canBroadcastChat,
          canExportReports: formData.canExportReports,
          canDeleteRecords: formData.canDeleteRecords,
          canViewFinancials: formData.canViewFinancials,
          canCreateJobCards: formData.canCreateJobCards,
          canEditJobCards: formData.canEditJobCards,
          canDeleteJobCards: formData.canDeleteJobCards,
          canAdvanceJobStage: formData.canAdvanceJobStage,
          canViewJobCosts: formData.canViewJobCosts,
          canCreateDesigns: formData.canCreateDesigns,
          canInputNewDesign: formData.canInputNewDesign,
          canEditDesigns: formData.canEditDesigns,
          canDeleteDesigns: formData.canDeleteDesigns,
          canViewDesignCosts: formData.canViewDesignCosts,
          canAddFabricInward: formData.canAddFabricInward,
          canIssueFabricOutward: formData.canIssueFabricOutward,
          canTransferFabricLot: formData.canTransferFabricLot,
          canDeleteFabricLogs: formData.canDeleteFabricLogs,
          canViewFabricPrices: formData.canViewFabricPrices,
          canCreateInvoices: formData.canCreateInvoices,
          canEditInvoiceRates: formData.canEditInvoiceRates,
          canCancelInvoices: formData.canCancelInvoices,
          canRecordPayments: formData.canRecordPayments,
          canCreateStitchingJobs: formData.canCreateStitchingJobs,
          canIssueStitchingChallans: formData.canIssueStitchingChallans,
          canManageWorkerRates: formData.canManageWorkerRates,
          allowedCompanies: formData.allowedCompanies,
          permissions: formData.permissions
        };
        if (formData.password && formData.password.trim()) {
          updatePayload.password = formData.password.trim();
        }

        const targetUserId = editingUser.id || editingUser._id;
        if (!targetUserId) {
          throw new Error('User ID not found for update.');
        }

        const updatedRes = await api.updateUser(targetUserId, updatePayload);
        const loggedUser = api.getCurrentUser();
        if (loggedUser && (loggedUser.id === targetUserId || loggedUser._id === targetUserId)) {
          if (updatedRes && updatedRes.user) {
            localStorage.setItem('elite_user', JSON.stringify(updatedRes.user));
          } else {
            localStorage.setItem('elite_user', JSON.stringify({ ...loggedUser, ...updatePayload }));
          }
        }

        setSuccess(`User "${formData.name}" credentials & permissions updated successfully.`);
        triggerPushNotification('👤 User Updated', `User "${formData.name}" updated successfully!`, 'info');
      } else {
        await api.createUser({
          name: formData.name.trim(),
          email: formData.email.trim(),
          password: formData.password.trim(),
          role: formData.role,
          isMainAdmin: formData.isMainAdmin,
          department: formData.department,
          status: formData.status,
          canManageTasks: formData.canManageTasks,
          canBroadcastChat: formData.canBroadcastChat,
          canExportReports: formData.canExportReports,
          canDeleteRecords: formData.canDeleteRecords,
          canViewFinancials: formData.canViewFinancials,
          canCreateJobCards: formData.canCreateJobCards,
          canEditJobCards: formData.canEditJobCards,
          canDeleteJobCards: formData.canDeleteJobCards,
          canAdvanceJobStage: formData.canAdvanceJobStage,
          canViewJobCosts: formData.canViewJobCosts,
          canCreateDesigns: formData.canCreateDesigns,
          canInputNewDesign: formData.canInputNewDesign,
          canEditDesigns: formData.canEditDesigns,
          canDeleteDesigns: formData.canDeleteDesigns,
          canViewDesignCosts: formData.canViewDesignCosts,
          canAddFabricInward: formData.canAddFabricInward,
          canIssueFabricOutward: formData.canIssueFabricOutward,
          canTransferFabricLot: formData.canTransferFabricLot,
          canDeleteFabricLogs: formData.canDeleteFabricLogs,
          canViewFabricPrices: formData.canViewFabricPrices,
          canCreateInvoices: formData.canCreateInvoices,
          canEditInvoiceRates: formData.canEditInvoiceRates,
          canCancelInvoices: formData.canCancelInvoices,
          canRecordPayments: formData.canRecordPayments,
          canCreateStitchingJobs: formData.canCreateStitchingJobs,
          canIssueStitchingChallans: formData.canIssueStitchingChallans,
          canManageWorkerRates: formData.canManageWorkerRates,
          allowedCompanies: formData.allowedCompanies,
          permissions: formData.permissions
        });
        setSuccess(`User "${formData.name}" created successfully.`);
        triggerPushNotification('👤 User Account Created', `User "${formData.name}" added successfully!`, 'success');
      }

      setShowUserModal(false);
      handleCancelEdit();
      fetchUsers();
    } catch (err) {
      const errMsg = err.message || 'Failed to save user.';
      setError(errMsg);
      setModalError(errMsg);
    } finally {
      setSubmitLoading(false);
    }
  };

  const handleDeleteUser = async (user) => {
    const currentUser = api.getCurrentUser();
    if (currentUser && currentUser.id === user.id) {
      setError("You cannot delete your own logged-in account.");
      return;
    }

    if (!window.confirm(`Are you sure you want to delete user "${user.name}"?`)) return;

    setError('');
    setSuccess('');
    try {
      await api.deleteUser(user.id);
      setSuccess(`User "${user.name}" deleted successfully.`);
      fetchUsers();
      if (editingUser && editingUser.id === user.id) {
        handleCancelEdit();
      }
    } catch (err) {
      setError(err.message || 'Failed to delete user.');
    }
  };

  const PRIVILEGE_KEYS = [
    'canManageTasks', 'canBroadcastChat', 'canExportReports', 'canDeleteRecords', 'canViewFinancials',
    'canCreateJobCards', 'canEditJobCards', 'canDeleteJobCards', 'canAdvanceJobStage', 'canViewJobCosts',
    'canCreateDesigns', 'canInputNewDesign', 'canEditDesigns', 'canDeleteDesigns', 'canViewDesignCosts',
    'canAddFabricInward', 'canIssueFabricOutward', 'canTransferFabricLot', 'canDeleteFabricLogs', 'canViewFabricPrices',
    'canCreateInvoices', 'canEditInvoiceRates', 'canCancelInvoices', 'canRecordPayments',
    'canCreateStitchingJobs', 'canIssueStitchingChallans', 'canManageWorkerRates'
  ];
  const activePrivilegesCount = PRIVILEGE_KEYS.filter(k => formData[k]).length;

  const filteredUsers = users.filter(u => {
    const matchesSearch = matchSearchQuery(u, userSearch, ['name', 'email', 'role', 'department']);
    const matchesCompany = selectedCompanyFilter === 'All' || (Array.isArray(u.allowedCompanies) && u.allowedCompanies.includes(selectedCompanyFilter));
    const matchesDept = selectedDeptFilter === 'All' || u.department === selectedDeptFilter;
    const matchesStatus = selectedStatusFilter === 'All' || (u.status || 'Active') === selectedStatusFilter;
    return matchesSearch && matchesCompany && matchesDept && matchesStatus;
  });

  return (
    <div style={styles.container}>
      {/* Page Title Header */}
      <div className="glass-panel" style={styles.topBar}>
        <div style={styles.topBarLeft}>
          <ShieldAlert size={22} color="var(--primary)" />
          <div>
            <h2 style={styles.pageTitle}>
              {activeSubTab === 'users'
                ? 'Admin User Management'
                : activeSubTab === 'approvals'
                ? 'Review & Approvals Queue'
                : activeSubTab === 'dataReview'
                ? 'User Data Entry Review & Audit Feed'
                : activeSubTab === 'clients'
                ? 'Client Details & Accounts'
                : activeSubTab === 'billing'
                ? 'Infrastructure Billing Management'
                : activeSubTab === 'backup'
                ? 'System Data Backup & Export'
                : activeSubTab === 'signedDocs'
                ? 'Signed Documents Approval'
                : 'Department Expense Settings'}
            </h2>
            <p style={styles.pageSubtitle}>
              {activeSubTab === 'users'
                ? 'Create system users, set passwords, and manage screen-by-screen functionality credentials.'
                : activeSubTab === 'approvals'
                ? 'Review, authorize, or reject data modifications and deletion requests submitted by non-admin staff.'
                : activeSubTab === 'dataReview'
                ? 'Audit and inspect all data entries, invoices, job cards, expenses, and fabric transactions entered by users.'
                : activeSubTab === 'clients'
                ? 'Manage client user accounts, company codes, credentials, and Cloudflare R2 profile images.'
                : activeSubTab === 'billing'
                ? 'Track monthly cloud bills for AWS and MongoDB to monitor hosting costs.'
                : activeSubTab === 'backup'
                ? 'Export comprehensive system data filtered by department and custom date ranges.'
                : activeSubTab === 'signedDocs'
                ? 'Review and verify customer-signed physical copies of Challans and Invoices stored in Cloudflare R2.'
                : 'Configure Cash IN categories, Cash OUT categories, and Payment Modes for department expense entry forms.'}
            </p>
          </div>
        </div>
      </div>

      {/* Sub Tabs Selection (Scrollable on iOS & Mobile) */}
      <div className="tab-scroll-container" style={{
        display: 'flex',
        gap: '0.5rem',
        overflowX: 'auto',
        WebkitOverflowScrolling: 'touch',
        paddingBottom: '4px',
        maxWidth: '100%'
      }}>
        <button
          onClick={() => { setActiveSubTab('users'); setError(''); setSuccess(''); }}
          className={activeSubTab === 'users' ? 'btn-primary' : 'btn-secondary'}
          style={{ padding: '0.5rem 1.2rem', fontSize: '0.85rem', flexShrink: 0, whiteSpace: 'nowrap' }}
        >
          <User size={16} /> User Accounts
        </button>
        <button
          onClick={() => { setActiveSubTab('approvals'); setError(''); setSuccess(''); }}
          className={activeSubTab === 'approvals' ? 'btn-primary' : 'btn-secondary'}
          style={{ padding: '0.5rem 1.2rem', fontSize: '0.85rem', display: 'inline-flex', alignItems: 'center', gap: '0.4rem', position: 'relative', flexShrink: 0, whiteSpace: 'nowrap' }}
        >
          <ShieldAlert size={16} /> Review & Approvals
          {pendingApprovalsCount > 0 && (
            <span style={{
              background: '#2563eb',
              color: '#ffffff',
              fontSize: '0.68rem',
              fontWeight: 900,
              padding: '1px 7px',
              borderRadius: '10px',
              marginLeft: '4px',
              boxShadow: '0 1px 3px rgba(37,99,235,0.3)'
            }}>
              {pendingApprovalsCount}
            </span>
          )}
        </button>
        <button
          onClick={() => { setActiveSubTab('dataReview'); setError(''); setSuccess(''); }}
          className={activeSubTab === 'dataReview' ? 'btn-primary' : 'btn-secondary'}
          style={{ padding: '0.5rem 1.2rem', fontSize: '0.85rem', display: 'inline-flex', alignItems: 'center', gap: '0.4rem', flexShrink: 0, whiteSpace: 'nowrap' }}
        >
          <FileText size={16} /> Data Entry Review
        </button>
        <button
          onClick={() => { setActiveSubTab('clients'); setError(''); setSuccess(''); }}
          className={activeSubTab === 'clients' ? 'btn-primary' : 'btn-secondary'}
          style={{ padding: '0.5rem 1.2rem', fontSize: '0.85rem', display: 'inline-flex', alignItems: 'center', gap: '0.4rem', flexShrink: 0, whiteSpace: 'nowrap' }}
        >
          <Users size={16} /> Client Details
        </button>
        <button
          onClick={() => { setActiveSubTab('settings'); setError(''); setSuccess(''); }}
          className={activeSubTab === 'settings' ? 'btn-primary' : 'btn-secondary'}
          style={{ padding: '0.5rem 1.2rem', fontSize: '0.85rem', display: 'inline-flex', alignItems: 'center', gap: '0.4rem', flexShrink: 0, whiteSpace: 'nowrap' }}
        >
          <Settings size={16} /> Expense Settings
        </button>
        <button
          onClick={() => { setActiveSubTab('billing'); setError(''); setSuccess(''); }}
          className={activeSubTab === 'billing' ? 'btn-primary' : 'btn-secondary'}
          style={{ padding: '0.5rem 1.2rem', fontSize: '0.85rem', flexShrink: 0, whiteSpace: 'nowrap' }}
        >
          <CreditCard size={16} /> Infrastructure Billing
        </button>
        <button
          onClick={() => { setActiveSubTab('backup'); setError(''); setSuccess(''); }}
          className={activeSubTab === 'backup' ? 'btn-primary' : 'btn-secondary'}
          style={{ padding: '0.5rem 1.2rem', fontSize: '0.85rem', display: 'inline-flex', alignItems: 'center', gap: '0.4rem', flexShrink: 0, whiteSpace: 'nowrap' }}
        >
          <Database size={16} /> Data Backup
        </button>
        <button
          onClick={() => { setActiveSubTab('signedDocs'); setError(''); setSuccess(''); }}
          className={activeSubTab === 'signedDocs' ? 'btn-primary' : 'btn-secondary'}
          style={{ padding: '0.5rem 1.2rem', fontSize: '0.85rem', display: 'inline-flex', alignItems: 'center', gap: '0.4rem', flexShrink: 0, whiteSpace: 'nowrap' }}
        >
          <FileCheck size={16} /> Signed Documents Approval
        </button>
      </div>

      {error && <div style={styles.errorBox}>{error}</div>}
      {success && <div style={styles.successBox}>{success}</div>}

      {activeSubTab === 'users' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
          {/* Summary Metric Cards Header */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem' }}>
            <div className="glass-panel" style={{ padding: '1rem 1.25rem', display: 'flex', alignItems: 'center', gap: '0.85rem', borderLeft: '4px solid #2563eb' }}>
              <div style={{ width: 38, height: 38, borderRadius: 10, background: '#eff6ff', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <User size={20} color="#2563eb" />
              </div>
              <div>
                <div style={{ fontSize: '0.72rem', fontWeight: 700, color: '#64748b', textTransform: 'uppercase' }}>Total Registered Accounts</div>
                <div style={{ fontSize: '1.4rem', fontWeight: 800, color: '#0f172a', marginTop: 2 }}>{users.length} Users</div>
              </div>
            </div>

            <div className="glass-panel" style={{ padding: '1rem 1.25rem', display: 'flex', alignItems: 'center', gap: '0.85rem', borderLeft: '4px solid #dc2626' }}>
              <div style={{ width: 38, height: 38, borderRadius: 10, background: '#fef2f2', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <ShieldAlert size={20} color="#dc2626" />
              </div>
              <div>
                <div style={{ fontSize: '0.72rem', fontWeight: 700, color: '#64748b', textTransform: 'uppercase' }}>Administrator Roles</div>
                <div style={{ fontSize: '1.4rem', fontWeight: 800, color: '#dc2626', marginTop: 2 }}>
                  {users.filter(u => u.role === 'admin' || (u.permissions && u.permissions.length === AVAILABLE_SCREENS.length)).length} Admins
                </div>
              </div>
            </div>

            <div className="glass-panel" style={{ padding: '1rem 1.25rem', display: 'flex', alignItems: 'center', gap: '0.85rem', borderLeft: '4px solid #16a34a' }}>
              <div style={{ width: 38, height: 38, borderRadius: 10, background: '#f0fdf4', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <UserPlus size={20} color="#16a34a" />
              </div>
              <div>
                <div style={{ fontSize: '0.72rem', fontWeight: 700, color: '#64748b', textTransform: 'uppercase' }}>Standard Accounts</div>
                <div style={{ fontSize: '1.4rem', fontWeight: 800, color: '#16a34a', marginTop: 2 }}>
                  {users.filter(u => u.role !== 'admin' && (u.permissions?.length !== AVAILABLE_SCREENS.length)).length} Standard Users
                </div>
              </div>
            </div>
          </div>

          {/* 100% Full-Width Users Table Panel */}
          <div className="glass-panel" style={{ ...styles.tablePanel, width: '100%', padding: '1.25rem' }}>
            {/* Header with Title, Stats Badges, and Add Button */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.75rem', paddingBottom: '0.75rem', borderBottom: '1px solid #e2e8f0' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                <div style={{
                  width: 38,
                  height: 38,
                  borderRadius: 10,
                  background: 'linear-gradient(135deg, #eff6ff 0%, #dbeafe 100%)',
                  border: '1px solid #bfdbfe',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  boxShadow: '0 2px 4px rgba(37, 99, 235, 0.08)'
                }}>
                  <Users size={20} color="#2563eb" />
                </div>
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <h3 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 800, color: '#0f172a', letterSpacing: '-0.01em' }}>
                      Active User Accounts
                    </h3>
                    <span style={{
                      fontSize: '0.75rem',
                      fontWeight: 800,
                      padding: '0.15rem 0.6rem',
                      borderRadius: '999px',
                      background: '#eff6ff',
                      color: '#1d4ed8',
                      border: '1px solid #bfdbfe'
                    }}>
                      {filteredUsers.length}{filteredUsers.length !== users.length ? ` of ${users.length}` : ''}
                    </span>
                    {loading && <RotateCw size={14} className="spin-loader" style={{ color: '#64748b' }} />}
                  </div>
                  <p style={{ margin: '2px 0 0 0', fontSize: '0.76rem', color: '#64748b' }}>
                    Manage access credentials, company entity assignments, and operational permissions
                  </p>
                </div>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
                {/* Active / Inactive quick count badges */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', background: '#f8fafc', padding: '0.25rem 0.6rem', borderRadius: '8px', border: '1px solid #e2e8f0', fontSize: '0.75rem', fontWeight: 700 }}>
                  <span style={{ color: '#16a34a', display: 'flex', alignItems: 'center', gap: '3px' }}>
                    ● {users.filter(u => u.status !== 'Inactive').length} Active
                  </span>
                  {users.filter(u => u.status === 'Inactive').length > 0 && (
                    <>
                      <span style={{ color: '#cbd5e1' }}>|</span>
                      <span style={{ color: '#dc2626', display: 'flex', alignItems: 'center', gap: '3px' }}>
                        ● {users.filter(u => u.status === 'Inactive').length} Inactive
                      </span>
                    </>
                  )}
                </div>

                <button
                  type="button"
                  onClick={handleCreateNewClick}
                  className="btn-primary"
                  style={{
                    padding: '0.5rem 1.15rem',
                    fontSize: '0.85rem',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '0.45rem',
                    borderRadius: '8px',
                    fontWeight: 700,
                    boxShadow: '0 4px 14px rgba(37, 99, 235, 0.3)',
                    background: 'linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%)',
                    cursor: 'pointer'
                  }}
                >
                  <UserPlus size={16} />
                  <span>Add New User</span>
                </button>
              </div>
            </div>

            {/* Filter & Search Toolbar (Unified Single-Line Row / Responsive on Mobile) */}
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.6rem',
              marginTop: '0.85rem',
              padding: isMobile ? '0.55rem 0.65rem' : '0.65rem 0.85rem',
              background: '#f8fafc',
              borderRadius: '10px',
              border: '1px solid #e2e8f0',
              flexWrap: 'wrap'
            }}>
              {/* Search input container */}
              <div style={{ position: 'relative', flex: isMobile ? '1 1 100%' : '1 1 240px', minWidth: isMobile ? '100%' : '220px' }}>
                <Search size={15} style={{ position: 'absolute', left: 11, top: '50%', transform: 'translateY(-50%)', color: '#64748b' }} />
                <input
                  type="text"
                  placeholder="Search by name, email, department, or role..."
                  value={userSearch}
                  onChange={e => setUserSearch(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '0.55rem 1.8rem 0.55rem 2.2rem',
                    fontSize: '16px',
                    minHeight: '44px',
                    background: '#ffffff',
                    border: '1px solid #cbd5e1',
                    color: '#0f172a',
                    borderRadius: '7px',
                    boxShadow: '0 1px 2px rgba(0,0,0,0.03)',
                    outline: 'none',
                    boxSizing: 'border-box'
                  }}
                />
                {userSearch && (
                  <button
                    type="button"
                    onClick={() => setUserSearch('')}
                    style={{
                      position: 'absolute',
                      right: 8,
                      top: '50%',
                      transform: 'translateY(-50%)',
                      background: 'none',
                      border: 'none',
                      color: '#94a3b8',
                      cursor: 'pointer',
                      padding: 2,
                      display: 'flex',
                      alignItems: 'center'
                    }}
                    title="Clear search"
                  >
                    <X size={14} />
                  </button>
                )}
              </div>

              {/* Company Filter Dropdown */}
              <div style={{ flex: isMobile ? '1 1 calc(50% - 0.3rem)' : '0 0 auto', minWidth: isMobile ? '130px' : '170px' }}>
                <select
                  value={selectedCompanyFilter}
                  onChange={e => setSelectedCompanyFilter(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '0.55rem 0.75rem',
                    fontSize: '16px',
                    minHeight: '44px',
                    borderRadius: '7px',
                    border: selectedCompanyFilter !== 'All' ? '1px solid #3b82f6' : '1px solid #cbd5e1',
                    background: selectedCompanyFilter !== 'All' ? '#eff6ff' : '#ffffff',
                    color: selectedCompanyFilter !== 'All' ? '#1d4ed8' : '#0f172a',
                    fontWeight: 700,
                    cursor: 'pointer',
                    boxShadow: '0 1px 2px rgba(0,0,0,0.03)',
                    boxSizing: 'border-box',
                    outline: 'none',
                    WebkitAppearance: 'none'
                  }}
                >
                  <option value="All">🌐 All Companies ({users.length})</option>
                  <option value="Elite Edition">🏢 Elite Edition ({users.filter(u => u.allowedCompanies?.includes('Elite Edition')).length})</option>
                  <option value="Elite Fabtex">🏭 Elite Fabtex ({users.filter(u => u.allowedCompanies?.includes('Elite Fabtex')).length})</option>
                  <option value="Elite Online">🏪 Elite Online ({users.filter(u => u.allowedCompanies?.includes('Elite Online')).length})</option>
                  <option value="Elite Stitching">✂️ Elite Stitching ({users.filter(u => u.allowedCompanies?.includes('Elite Stitching')).length})</option>
                  <option value="Elite Digital Print">🖨️ Elite Digital Print ({users.filter(u => u.allowedCompanies?.includes('Elite Digital Print')).length})</option>
                </select>
              </div>

              {/* Department Filter Dropdown */}
              <div style={{ flex: isMobile ? '1 1 calc(50% - 0.3rem)' : '0 0 auto', minWidth: isMobile ? '130px' : '160px' }}>
                <select
                  value={selectedDeptFilter}
                  onChange={e => setSelectedDeptFilter(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '0.55rem 0.75rem',
                    fontSize: '16px',
                    minHeight: '44px',
                    borderRadius: '7px',
                    border: selectedDeptFilter !== 'All' ? '1px solid #3b82f6' : '1px solid #cbd5e1',
                    background: selectedDeptFilter !== 'All' ? '#eff6ff' : '#ffffff',
                    color: selectedDeptFilter !== 'All' ? '#1d4ed8' : '#0f172a',
                    fontWeight: 700,
                    cursor: 'pointer',
                    boxShadow: '0 1px 2px rgba(0,0,0,0.03)',
                    boxSizing: 'border-box',
                    outline: 'none',
                    WebkitAppearance: 'none'
                  }}
                >
                  <option value="All">🏷️ All Departments</option>
                  {DEPARTMENTS_LIST.map(d => (
                    <option key={d} value={d}>{d}</option>
                  ))}
                </select>
              </div>

              {/* Status Filter Dropdown */}
              <div style={{ flex: isMobile ? '1 1 100%' : '0 0 auto', minWidth: isMobile ? '100%' : '135px' }}>
                <select
                  value={selectedStatusFilter}
                  onChange={e => setSelectedStatusFilter(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '0.55rem 0.75rem',
                    fontSize: '16px',
                    minHeight: '44px',
                    borderRadius: '7px',
                    border: selectedStatusFilter !== 'All' ? '1px solid #3b82f6' : '1px solid #cbd5e1',
                    background: selectedStatusFilter !== 'All' ? '#eff6ff' : '#ffffff',
                    color: selectedStatusFilter !== 'All' ? '#1d4ed8' : '#0f172a',
                    fontWeight: 700,
                    cursor: 'pointer',
                    boxShadow: '0 1px 2px rgba(0,0,0,0.03)',
                    boxSizing: 'border-box',
                    outline: 'none',
                    WebkitAppearance: 'none'
                  }}
                >
                  <option value="All">⚡ All Statuses</option>
                  <option value="Active">🟢 Active</option>
                  <option value="Inactive">🔴 Inactive / Suspended</option>
                </select>
              </div>

              {/* Reset Filters Shortcut */}
              {(userSearch || selectedCompanyFilter !== 'All' || selectedDeptFilter !== 'All' || selectedStatusFilter !== 'All') && (
                <button
                  type="button"
                  onClick={() => {
                    setUserSearch('');
                    setSelectedCompanyFilter('All');
                    setSelectedDeptFilter('All');
                    setSelectedStatusFilter('All');
                  }}
                  style={{
                    padding: '0.48rem 0.75rem',
                    fontSize: '0.78rem',
                    fontWeight: 700,
                    color: '#dc2626',
                    background: '#fef2f2',
                    border: '1px solid #fecaca',
                    borderRadius: '7px',
                    cursor: 'pointer',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '5px',
                    boxShadow: '0 1px 2px rgba(220, 38, 38, 0.05)',
                    width: isMobile ? '100%' : 'auto',
                    justifyContent: 'center'
                  }}
                  title="Clear all active search and filter constraints"
                >
                  <FilterX size={13} />
                  <span>Clear Filters</span>
                </button>
              )}
            </div>

            <div className="table-container" style={styles.tableWrap}>
              {loading && users.length === 0 ? (
                <div style={styles.emptyState}>
                  <RotateCw size={24} className="spin-loader" color="var(--primary)" />
                  <p style={{ marginTop: '0.5rem', color: 'var(--text-muted)' }}>Loading users list...</p>
                </div>
              ) : users.length === 0 ? (
                <div style={styles.emptyState}>
                  <User size={28} color="var(--text-muted)" />
                  <p style={{ marginTop: '0.5rem', color: 'var(--text-muted)' }}>No user accounts found.</p>
                </div>
              ) : filteredUsers.length === 0 ? (
                <div style={{ ...styles.emptyState, padding: '3rem 1rem' }}>
                  <FilterX size={32} color="#94a3b8" />
                  <h4 style={{ margin: '0.6rem 0 0.2rem 0', color: '#1e293b' }}>No Matching Accounts Found</h4>
                  <p style={{ margin: 0, fontSize: '0.85rem', color: '#64748b' }}>
                    No users match your search query or selected filter criteria.
                  </p>
                  <button
                    type="button"
                    onClick={() => {
                      setUserSearch('');
                      setSelectedCompanyFilter('All');
                      setSelectedDeptFilter('All');
                      setSelectedStatusFilter('All');
                    }}
                    className="btn-secondary"
                    style={{ marginTop: '0.85rem', padding: '0.45rem 0.9rem', fontSize: '0.8rem', fontWeight: 700 }}
                  >
                    Reset All Filters
                  </button>
                </div>
              ) : (
                <table>
                  <thead>
                    <tr>
                      <th>Account & Status</th>
                      <th>Email & Department</th>
                      <th>Role & Hierarchy</th>
                      <th>Allocated Companies</th>
                      <th>Action Privileges</th>
                      <th>Allowed Functionalities</th>
                      <th className="text-center">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredUsers
                      .map((u) => {
                        const isMain = Boolean(u.isMainAdmin || u.email === 'harshitsidapara2468@gmail.com');
                        const checkAdmin = u.role === 'admin' || isMain;
                        const isCurrentlyEditing = editingUser && (editingUser.id === u.id || editingUser._id === u.id);
                        const userCompanies = Array.isArray(u.allowedCompanies) && u.allowedCompanies.length > 0
                          ? u.allowedCompanies
                          : ALL_COMPANY_NAMES;
                        const isInactive = u.status === 'Inactive';

                        return (
                          <tr key={u.id || u._id} style={{ background: isCurrentlyEditing ? '#eff6ff' : isInactive ? '#fff1f2' : 'transparent', transition: 'background 0.15s', opacity: isInactive ? 0.75 : 1 }}>
                            <td>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
                                <div style={styles.avatar(checkAdmin)}>
                                  {u.name ? u.name[0].toUpperCase() : 'U'}
                                </div>
                                <div>
                                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                                    <span style={{ fontWeight: '700', color: '#0f172a', fontSize: '0.88rem' }}>
                                      {u.name} {isMain && <span title="Super Master Admin">👑</span>}
                                    </span>
                                    <span style={{
                                      fontSize: '0.65rem',
                                      fontWeight: 800,
                                      padding: '1px 6px',
                                      borderRadius: '4px',
                                      background: isInactive ? '#fee2e2' : '#dcfce7',
                                      color: isInactive ? '#991b1b' : '#166534',
                                      border: `1px solid ${isInactive ? '#fca5a5' : '#86efac'}`
                                    }}>
                                      {isInactive ? '🔴 INACTIVE' : '🟢 ACTIVE'}
                                    </span>
                                  </div>
                                  {isCurrentlyEditing && (
                                    <span style={{ fontSize: '0.68rem', color: '#2563eb', fontWeight: 800, display: 'block' }}>[Editing Now]</span>
                                  )}
                                </div>
                              </div>
                            </td>
                            <td>
                              <div style={{ color: '#334155', fontWeight: 600, fontSize: '0.82rem' }}>{u.email}</div>
                              <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap', marginTop: '2px' }}>
                                <span style={{
                                  fontSize: '0.68rem',
                                  fontWeight: 700,
                                  color: '#475569',
                                  background: '#f1f5f9',
                                  padding: '1px 6px',
                                  borderRadius: '4px',
                                  border: '1px solid #cbd5e1'
                                }}>
                                  📁 {u.department || 'General'}
                                </span>
                                {u.designerName && (
                                  <span style={{
                                    fontSize: '0.68rem',
                                    fontWeight: 700,
                                    color: '#1d4ed8',
                                    background: '#eff6ff',
                                    padding: '1px 6px',
                                    borderRadius: '4px',
                                    border: '1px solid #bfdbfe'
                                  }}>
                                    🎨 {u.designerName}
                                  </span>
                                )}
                              </div>
                            </td>
                            <td>
                              <span style={{
                                fontSize: '0.7rem',
                                fontWeight: 800,
                                padding: '3px 9px',
                                borderRadius: '6px',
                                textTransform: 'uppercase',
                                background: isMain ? '#fef3c7' : checkAdmin ? '#fee2e2' : '#dbeafe',
                                color: isMain ? '#92400e' : checkAdmin ? '#dc2626' : '#1d4ed8',
                                border: `1px solid ${isMain ? '#fcd34d' : checkAdmin ? '#fca5a5' : '#93c5fd'}`
                              }}>
                                {isMain ? '👑 MAIN ADMIN' : checkAdmin ? '🛡️ COMPANY ADMIN' : '👤 USER'}
                              </span>
                            </td>
                            <td>
                              <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap' }}>
                                {isMain ? (
                                  <span style={{ fontSize: '0.7rem', fontWeight: 800, color: '#047857', background: '#d1fae5', padding: '2px 7px', borderRadius: '4px', border: '1px solid #a7f3d0' }}>
                                    🌐 ALL COMPANIES (MASTER)
                                  </span>
                                ) : userCompanies.map(c => (
                                  <span key={c} style={{ fontSize: '0.68rem', fontWeight: 700, color: '#334155', background: '#f1f5f9', padding: '2px 6px', borderRadius: '4px', border: '1px solid #cbd5e1' }}>
                                    {c}
                                  </span>
                                ))}
                              </div>
                            </td>
                            <td>
                              <div style={{ display: 'flex', gap: '3px', flexWrap: 'wrap' }}>
                                <span title="Task Assignment Rights" style={{ fontSize: '0.68rem', fontWeight: 700, padding: '1px 5px', borderRadius: '4px', background: (u.canManageTasks !== false) ? '#eff6ff' : '#f1f5f9', color: (u.canManageTasks !== false) ? '#2563eb' : '#94a3b8', border: '1px solid #cbd5e1' }}>
                                  📋 Tasks: {(u.canManageTasks !== false) ? 'YES' : 'NO'}
                                </span>
                                <span title="Chat Announcement Broadcasting" style={{ fontSize: '0.68rem', fontWeight: 700, padding: '1px 5px', borderRadius: '4px', background: (u.canBroadcastChat !== false) ? '#f0fdf4' : '#f1f5f9', color: (u.canBroadcastChat !== false) ? '#16a34a' : '#94a3b8', border: '1px solid #cbd5e1' }}>
                                  💬 Chat: {(u.canBroadcastChat !== false) ? 'YES' : 'NO'}
                                </span>
                                <span title="Export Excel/PDF" style={{ fontSize: '0.68rem', fontWeight: 700, padding: '1px 5px', borderRadius: '4px', background: (u.canExportReports !== false) ? '#faf5ff' : '#f1f5f9', color: (u.canExportReports !== false) ? '#9333ea' : '#94a3b8', border: '1px solid #cbd5e1' }}>
                                  📥 Export: {(u.canExportReports !== false) ? 'YES' : 'NO'}
                                </span>
                                <span title="Edit/Delete Master Records" style={{ fontSize: '0.68rem', fontWeight: 700, padding: '1px 5px', borderRadius: '4px', background: (u.canDeleteRecords !== false) ? '#fff7ed' : '#f1f5f9', color: (u.canDeleteRecords !== false) ? '#ea580c' : '#94a3b8', border: '1px solid #cbd5e1' }}>
                                  ✏️ Edit/Del: {(u.canDeleteRecords !== false) ? 'YES' : 'NO'}
                                </span>
                                <span title="View Purchase Rates & Financial Margins" style={{ fontSize: '0.68rem', fontWeight: 700, padding: '1px 5px', borderRadius: '4px', background: (u.canViewFinancials !== false) ? '#fefce8' : '#f1f5f9', color: (u.canViewFinancials !== false) ? '#ca8a04' : '#94a3b8', border: '1px solid #cbd5e1' }}>
                                  💰 Price: {(u.canViewFinancials !== false) ? 'YES' : 'NO'}
                                </span>
                              </div>
                            </td>
                            <td>
                              <div style={styles.permissionsList}>
                                {checkAdmin ? (
                                  <span style={styles.adminAllBadge}>⚡ FULL SYSTEM ACCESS</span>
                                ) : u.permissions && u.permissions.length > 0 ? (
                                  u.permissions.map(p => {
                                    const screenObj = AVAILABLE_SCREENS.find(s => s.id === p);
                                    return (
                                      <span key={p} style={styles.permissionBadge}>
                                        {screenObj ? screenObj.label : p}
                                      </span>
                                    );
                                  })
                                ) : (
                                  <span style={styles.noScreensBadge}>NO ACCESS GRANTED</span>
                                )}
                              </div>
                            </td>
                            <td>
                              <div style={styles.actionsCell}>
                                <button
                                  onClick={() => handleEditClick(u)}
                                  style={{
                                    padding: '0.4rem 0.75rem',
                                    background: '#eff6ff',
                                    border: '1px solid #bfdbfe',
                                    color: '#2563eb',
                                    borderRadius: '6px',
                                    cursor: 'pointer',
                                    fontSize: '0.8rem',
                                    fontWeight: 700,
                                    display: 'inline-flex',
                                    alignItems: 'center',
                                    gap: '5px'
                                  }}
                                  title="Edit Credentials & Permissions"
                                >
                                  <Edit2 size={14} /> Edit
                                </button>
                                <button
                                  onClick={() => handleDeleteUser(u)}
                                  style={{
                                    padding: '0.4rem 0.75rem',
                                    background: '#fef2f2',
                                    border: '1px solid #fecaca',
                                    color: '#dc2626',
                                    borderRadius: '6px',
                                    cursor: 'pointer',
                                    fontSize: '0.8rem',
                                    fontWeight: 700,
                                    display: 'inline-flex',
                                    alignItems: 'center',
                                    gap: '5px'
                                  }}
                                  title="Delete User"
                                >
                                  <Trash2 size={14} /> Delete
                                </button>
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                  </tbody>
                </table>
              )}
            </div>
          </div>

          {/* 🌟 ENTERPRISE MODAL OVERLAY FOR USER CREATION & EDITING (iOS & Mobile Optimized) 🌟 */}
          {showUserModal && (
            <div style={{
              position: 'fixed',
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              backgroundColor: 'rgba(15, 23, 42, 0.75)',
              backdropFilter: 'blur(8px)',
              WebkitBackdropFilter: 'blur(8px)',
              zIndex: 99999,
              display: 'flex',
              alignItems: isMobile ? 'stretch' : 'center',
              justifyContent: 'center',
              padding: isMobile ? 0 : '1rem',
              animation: 'fadeIn 0.2s ease-out'
            }}>
              <div style={{
                background: '#ffffff',
                width: '100%',
                maxWidth: isMobile ? '100%' : '860px',
                height: isMobile ? '100dvh' : 'auto',
                maxHeight: isMobile ? '100dvh' : '90vh',
                borderRadius: isMobile ? 0 : '16px',
                boxShadow: '0 25px 60px -15px rgba(0, 0, 0, 0.4)',
                border: isMobile ? 'none' : '1px solid #cbd5e1',
                display: 'flex',
                flexDirection: 'column',
                overflow: 'hidden'
              }}>
                {/* Modal Header */}
                <div style={{
                  padding: isMobile
                    ? 'calc(0.75rem + env(safe-area-inset-top, 0px)) 1rem 0.75rem 1rem'
                    : '1.2rem 1.6rem',
                  background: 'linear-gradient(to bottom, #f8fafc, #ffffff)',
                  borderBottom: '1px solid #e2e8f0',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: '0.75rem',
                  flexShrink: 0
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.85rem' }}>
                    <div style={{
                      width: 40,
                      height: 40,
                      borderRadius: 12,
                      background: 'linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      boxShadow: '0 4px 12px rgba(37, 99, 235, 0.3)',
                      color: '#ffffff',
                      flexShrink: 0
                    }}>
                      {editingUser ? <Edit2 size={20} /> : <UserPlus size={20} />}
                    </div>
                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
                        <h3 style={{ margin: 0, fontSize: isMobile ? '1rem' : '1.15rem', fontWeight: 800, color: '#0f172a' }}>
                          {editingUser ? `Edit: ${editingUser.name}` : 'Create User Account'}
                        </h3>
                        {editingUser && (
                          <span style={{
                            fontSize: '0.72rem',
                            fontWeight: 800,
                            padding: '0.15rem 0.5rem',
                            borderRadius: '999px',
                            background: formData.status === 'Inactive' ? '#fee2e2' : '#dcfce7',
                            color: formData.status === 'Inactive' ? '#b91c1c' : '#15803d',
                            border: `1px solid ${formData.status === 'Inactive' ? '#fca5a5' : '#86efac'}`
                          }}>
                            {formData.status || 'Active'}
                          </span>
                        )}
                      </div>
                      <p style={{ margin: '2px 0 0 0', fontSize: '0.75rem', color: '#64748b' }}>
                        {editingUser
                          ? 'Modify role, company access boundaries, and operational permissions.'
                          : 'Configure credentials, entity rights, and role permissions.'}
                      </p>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={handleCancelEdit}
                    style={{
                      background: '#f1f5f9',
                      border: '1px solid #e2e8f0',
                      borderRadius: '50%',
                      width: 36,
                      height: 36,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      color: '#475569',
                      cursor: 'pointer',
                      flexShrink: 0,
                      transition: 'all 0.15s'
                    }}
                    title="Close"
                  >
                    <X size={18} />
                  </button>
                </div>

                {/* Segmented Navigation Tab Switcher (Scrollable horizontally on iOS) */}
                <div style={{
                  display: 'flex',
                  borderBottom: '1px solid #e2e8f0',
                  background: '#f8fafc',
                  padding: '0 0.5rem',
                  gap: '0.35rem',
                  overflowX: 'auto',
                  WebkitOverflowScrolling: 'touch',
                  flexShrink: 0,
                  scrollbarWidth: 'none',
                  msOverflowStyle: 'none'
                }}>
                  <button
                    type="button"
                    onClick={() => setModalTab('profile')}
                    style={{
                      padding: '0.8rem 1.1rem',
                      border: 'none',
                      background: 'none',
                      borderBottom: modalTab === 'profile' ? '2.5px solid #2563eb' : '2.5px solid transparent',
                      color: modalTab === 'profile' ? '#1d4ed8' : '#64748b',
                      fontWeight: modalTab === 'profile' ? 800 : 600,
                      fontSize: '0.85rem',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '0.45rem',
                      cursor: 'pointer',
                      transition: 'all 0.15s'
                    }}
                  >
                    <User size={16} />
                    <span>1. Profile & Role</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setModalTab('privileges')}
                    style={{
                      padding: '0.8rem 1.1rem',
                      border: 'none',
                      background: 'none',
                      borderBottom: modalTab === 'privileges' ? '2.5px solid #2563eb' : '2.5px solid transparent',
                      color: modalTab === 'privileges' ? '#1d4ed8' : '#64748b',
                      fontWeight: modalTab === 'privileges' ? 800 : 600,
                      fontSize: '0.85rem',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '0.45rem',
                      cursor: 'pointer',
                      transition: 'all 0.15s'
                    }}
                  >
                    <ShieldCheck size={16} />
                    <span>2. Operational Privileges</span>
                    <span style={{
                      fontSize: '0.7rem',
                      padding: '0.1rem 0.5rem',
                      borderRadius: 999,
                      background: modalTab === 'privileges' ? '#bfdbfe' : '#e2e8f0',
                      color: modalTab === 'privileges' ? '#1e40af' : '#475569',
                      fontWeight: 800
                    }}>
                      {activePrivilegesCount} / {PRIVILEGE_KEYS.length}
                    </span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setModalTab('screens')}
                    style={{
                      padding: isMobile ? '0.65rem 0.85rem' : '0.8rem 1.1rem',
                      border: 'none',
                      background: 'none',
                      borderBottom: modalTab === 'screens' ? '2.5px solid #2563eb' : '2.5px solid transparent',
                      color: modalTab === 'screens' ? '#1d4ed8' : '#64748b',
                      fontWeight: modalTab === 'screens' ? 800 : 600,
                      fontSize: '0.85rem',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '0.45rem',
                      cursor: 'pointer',
                      flexShrink: 0,
                      whiteSpace: 'nowrap',
                      transition: 'all 0.15s'
                    }}
                  >
                    <Layers size={16} />
                    <span>3. Screen Access</span>
                    <span style={{
                      fontSize: '0.7rem',
                      padding: '0.1rem 0.5rem',
                      borderRadius: 999,
                      background: modalTab === 'screens' ? '#bfdbfe' : '#e2e8f0',
                      color: modalTab === 'screens' ? '#1e40af' : '#475569',
                      fontWeight: 800
                    }}>
                      {formData.permissions?.length || 0} / {AVAILABLE_SCREENS.length}
                    </span>
                  </button>
                </div>

                {/* Modal Form Body */}
                <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', overflow: 'hidden', flex: 1, minHeight: 0 }}>
                  <div style={{
                    padding: isMobile ? '1rem' : '1.4rem 1.6rem',
                    overflowY: 'auto',
                    WebkitOverflowScrolling: 'touch',
                    flex: 1,
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '1.25rem'
                  }}>
                    
                    {/* Error Banner */}
                    {modalError && (
                      <div
                        style={{
                          background: '#fef2f2',
                          color: '#b91c1c',
                          border: '1px solid #fecaca',
                          padding: '0.75rem 1rem',
                          borderRadius: '8px',
                          fontSize: '0.85rem',
                          fontWeight: 600,
                          display: 'flex',
                          alignItems: 'center',
                          gap: '8px',
                        }}
                      >
                        <AlertCircle size={16} />
                        <span>{modalError}</span>
                      </div>
                    )}

                    {/* ========================================================= */}
                    {/* TAB 1: PROFILE, CREDENTIALS, ROLE & COMPANY ALLOCATION    */}
                    {/* ========================================================= */}
                    {modalTab === 'profile' && (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                        {/* ⚡ 1-Click Role Permission Presets Bar */}
                        <div style={{
                          background: 'linear-gradient(135deg, #f8fafc 0%, #eff6ff 100%)',
                          padding: '0.85rem 1rem',
                          borderRadius: '12px',
                          border: '1px solid #bfdbfe'
                        }}>
                          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                              <Sparkles size={15} color="#2563eb" />
                              <span style={{ fontSize: '0.78rem', fontWeight: 800, color: '#1d4ed8', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                                Quick 1-Click Role Presets
                              </span>
                            </div>
                            <span style={{ fontSize: '0.7rem', color: '#64748b' }}>
                              Auto-populates role, department, company access & screens
                            </span>
                          </div>

                          <div style={{ display: 'flex', gap: '0.45rem', flexWrap: 'wrap' }}>
                            {[
                              { key: 'full_admin', label: '⚡ Full Admin', color: '#1d4ed8', bg: '#eff6ff', border: '#bfdbfe' },
                              { key: 'executive', label: '👔 Executive', color: '#334155', bg: '#ffffff', border: '#cbd5e1' },
                              { key: 'production_manager', label: '🏭 Production Manager', color: '#334155', bg: '#ffffff', border: '#cbd5e1' },
                              { key: 'stitching_master', label: '✂️ Stitching Master', color: '#334155', bg: '#ffffff', border: '#cbd5e1' },
                              { key: 'ecommerce_manager', label: '🏪 E-Commerce Manager', color: '#334155', bg: '#ffffff', border: '#cbd5e1' },
                              { key: 'billing_clerk', label: '💰 Billing Clerk', color: '#334155', bg: '#ffffff', border: '#cbd5e1' },
                              { key: 'store_keeper', label: '📦 Store Keeper', color: '#334155', bg: '#ffffff', border: '#cbd5e1' }
                            ].map(p => (
                              <button
                                key={p.key}
                                type="button"
                                onClick={() => applyRolePreset(p.key)}
                                style={{
                                  padding: '0.35rem 0.7rem',
                                  fontSize: '0.74rem',
                                  fontWeight: 700,
                                  borderRadius: '6px',
                                  border: `1px solid ${p.border}`,
                                  background: p.bg,
                                  color: p.color,
                                  cursor: 'pointer',
                                  boxShadow: '0 1px 2px rgba(0,0,0,0.03)',
                                  transition: 'all 0.15s'
                                }}
                              >
                                {p.label}
                              </button>
                            ))}
                          </div>
                        </div>

                        {/* Basic Profile Grid */}
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '1rem' }}>
                          {/* Full Name */}
                          <div style={styles.formGroup}>
                            <label style={styles.label}>Full Name *</label>
                            <div style={styles.inputWrapper}>
                              <User size={15} style={styles.inputIcon} />
                              <input
                                type="text"
                                name="name"
                                value={formData.name}
                                onChange={handleInputChange}
                                placeholder="e.g. Rahul Sharma"
                                required
                                style={styles.formInput}
                              />
                            </div>
                          </div>

                          {/* Email Address */}
                          <div style={styles.formGroup}>
                            <label style={styles.label}>Email Address *</label>
                            <div style={styles.inputWrapper}>
                              <Mail size={15} style={styles.inputIcon} />
                              <input
                                type="email"
                                name="email"
                                value={formData.email}
                                onChange={handleInputChange}
                                placeholder="rahul@elite.com"
                                required
                                style={styles.formInput}
                              />
                            </div>
                          </div>

                          {/* Password */}
                          <div style={styles.formGroup}>
                            <label style={styles.label}>
                              {editingUser ? 'New Password (leave blank to keep current)' : 'Password *'}
                            </label>
                            <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
                              <Lock size={15} style={styles.inputIcon} />
                              <input
                                type={showPassword ? 'text' : 'password'}
                                name="password"
                                value={formData.password}
                                onChange={handleInputChange}
                                placeholder={editingUser ? 'Enter new password...' : 'Enter password...'}
                                required={!editingUser}
                                style={{ ...styles.formInput, paddingRight: '2.4rem' }}
                              />
                              <button
                                type="button"
                                onClick={() => setShowPassword(!showPassword)}
                                style={{
                                  position: 'absolute',
                                  right: 8,
                                  background: 'none',
                                  border: 'none',
                                  color: '#64748b',
                                  cursor: 'pointer',
                                  padding: 4,
                                  display: 'flex',
                                  alignItems: 'center'
                                }}
                                title={showPassword ? 'Hide Password' : 'Show Password'}
                              >
                                {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                              </button>
                            </div>
                          </div>

                          {/* Account Role & Hierarchy */}
                          <div style={styles.formGroup}>
                            <label style={styles.label}>Account Role & Hierarchy *</label>
                            <select
                              name="role"
                              value={formData.isMainAdmin ? 'main_admin' : formData.role}
                              onChange={(e) => {
                                const val = e.target.value;
                                if (val === 'main_admin') {
                                  setFormData(prev => ({
                                    ...prev,
                                    role: 'admin',
                                    isMainAdmin: true,
                                    allowedCompanies: ALL_COMPANY_NAMES,
                                    permissions: AVAILABLE_SCREENS.map(s => s.id)
                                  }));
                                } else if (val === 'admin') {
                                  setFormData(prev => ({
                                    ...prev,
                                    role: 'admin',
                                    isMainAdmin: false,
                                    permissions: AVAILABLE_SCREENS.map(s => s.id)
                                  }));
                                } else {
                                  setFormData(prev => ({
                                    ...prev,
                                    role: 'user',
                                    isMainAdmin: false
                                  }));
                                }
                              }}
                              style={styles.selectInput}
                            >
                              <option value="user">👤 Standard User (Restricted Screen Access)</option>
                              <option value="admin">🛡️ Company Admin (Allocated Company Authority)</option>
                              <option value="main_admin">👑 Main Admin / Super Admin (Master Control)</option>
                            </select>
                          </div>

                          {/* Primary Department */}
                          <div style={styles.formGroup}>
                            <label style={styles.label}>Primary Department *</label>
                            <select
                              name="department"
                              value={formData.department}
                              onChange={handleInputChange}
                              style={styles.selectInput}
                            >
                              {DEPARTMENTS_LIST.map(d => (
                                <option key={d} value={d}>📁 {d}</option>
                              ))}
                            </select>
                          </div>

                          {/* Account Status */}
                          <div style={styles.formGroup}>
                            <label style={styles.label}>Account Status *</label>
                            <select
                              name="status"
                              value={formData.status}
                              onChange={handleInputChange}
                              style={{
                                ...styles.selectInput,
                                color: formData.status === 'Inactive' ? '#dc2626' : '#16a34a',
                                fontWeight: 800
                              }}
                            >
                              <option value="Active">🟢 Active Account</option>
                              <option value="Inactive">🔴 Inactive / Suspended</option>
                            </select>
                          </div>
                        </div>

                        {/* Allocated Companies Section */}
                        <div style={{
                          background: '#f8fafc',
                          padding: '1rem',
                          borderRadius: '12px',
                          border: '1px solid #cbd5e1'
                        }}>
                          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.4rem', flexWrap: 'wrap', gap: '0.5rem' }}>
                            <div>
                              <div style={{ fontSize: '0.85rem', fontWeight: 800, color: '#1d4ed8', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                                🏢 Authorized Company Entities
                              </div>
                              <p style={{ fontSize: '0.74rem', color: '#64748b', margin: '2px 0 0 0' }}>
                                Select which business entities this account can access and switch between in the top bar.
                              </p>
                            </div>
                            {!formData.isMainAdmin && (
                              <div style={{ display: 'flex', gap: '0.4rem' }}>
                                <button
                                  type="button"
                                  onClick={() => setFormData(p => ({ ...p, allowedCompanies: ALL_COMPANY_NAMES }))}
                                  className="btn-secondary"
                                  style={{ padding: '0.25rem 0.6rem', fontSize: '0.72rem', fontWeight: 700 }}
                                >
                                  Select All
                                </button>
                                <button
                                  type="button"
                                  onClick={() => setFormData(p => ({ ...p, allowedCompanies: [] }))}
                                  className="btn-secondary"
                                  style={{ padding: '0.25rem 0.6rem', fontSize: '0.72rem', fontWeight: 700 }}
                                >
                                  Clear All
                                </button>
                              </div>
                            )}
                          </div>

                          <div style={{
                            display: 'grid',
                            gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
                            gap: '0.6rem',
                            marginTop: '0.6rem'
                          }}>
                            {ALL_COMPANY_NAMES.map(comp => {
                              const isChecked = formData.allowedCompanies.includes(comp);
                              return (
                                <label
                                  key={comp}
                                  style={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '0.6rem',
                                    padding: '0.6rem 0.8rem',
                                    borderRadius: '8px',
                                    border: `1.5px solid ${isChecked ? '#2563eb' : '#cbd5e1'}`,
                                    background: isChecked ? '#eff6ff' : '#ffffff',
                                    cursor: formData.isMainAdmin ? 'not-allowed' : 'pointer',
                                    fontSize: '0.82rem',
                                    fontWeight: isChecked ? 700 : 500,
                                    color: isChecked ? '#1d4ed8' : '#334155',
                                    transition: 'all 0.15s',
                                    boxShadow: isChecked ? '0 2px 4px rgba(37,99,235,0.08)' : 'none'
                                  }}
                                >
                                  <input
                                    type="checkbox"
                                    checked={isChecked || formData.isMainAdmin}
                                    disabled={formData.isMainAdmin}
                                    onChange={(e) => {
                                      const checked = e.target.checked;
                                      setFormData(prev => {
                                        const nextComps = checked
                                          ? Array.from(new Set([...prev.allowedCompanies, comp]))
                                          : prev.allowedCompanies.filter(c => c !== comp);
                                        return { ...prev, allowedCompanies: nextComps };
                                      });
                                    }}
                                    style={{ accentColor: '#2563eb', width: 16, height: 16 }}
                                  />
                                  <span>{comp}</span>
                                </label>
                              );
                            })}
                          </div>
                        </div>

                        {/* Connected Designer (Settings -> Designers) */}
                        <div style={styles.formGroup}>
                          <label style={styles.label}>🎨 Connected Designer (Settings &rarr; Designers)</label>
                          <select
                            name="designerName"
                            value={formData.designerName || ''}
                            onChange={handleInputChange}
                            style={styles.selectInput}
                          >
                            <option value="">-- None (Not a Designer) --</option>
                            {availableDesigners.map((d, i) => (
                              <option key={i} value={d}>👤 {d}</option>
                            ))}
                          </select>
                          <span style={{ fontSize: '0.72rem', color: '#64748b', marginTop: '3px', display: 'block' }}>
                            When selected, user will see only their own designs on the Designer Screen.
                          </span>
                        </div>
                      </div>
                    )}

                    {/* ========================================================= */}
                    {/* TAB 2: OPERATIONAL MICRO-PRIVILEGES                       */}
                    {/* ========================================================= */}
                    {modalTab === 'privileges' && (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                        {/* Privileges Header */}
                        <div style={{
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          flexWrap: 'wrap',
                          gap: '0.6rem',
                          background: '#f8fafc',
                          padding: '0.85rem 1rem',
                          borderRadius: '10px',
                          border: '1px solid #cbd5e1'
                        }}>
                          <div>
                            <div style={{ fontSize: '0.85rem', fontWeight: 800, color: '#1d4ed8', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                              ⚙️ Granular Operational & Micro-Level Privileges
                            </div>
                            <p style={{ fontSize: '0.74rem', color: '#64748b', margin: '2px 0 0 0' }}>
                              Configure functional capabilities (Create, Edit, Delete, Stage Advances, Costing & Margins) per user.
                            </p>
                          </div>
                          <div style={{ display: 'flex', gap: '0.45rem' }}>
                            <button
                              type="button"
                              onClick={() => setFormData(p => ({
                                ...p,
                                canManageTasks: true, canBroadcastChat: true, canExportReports: true, canDeleteRecords: true, canViewFinancials: true,
                                canCreateJobCards: true, canEditJobCards: true, canDeleteJobCards: true, canAdvanceJobStage: true, canViewJobCosts: true,
                                canCreateDesigns: true, canInputNewDesign: true, canEditDesigns: true, canDeleteDesigns: true, canViewDesignCosts: true,
                                canAddFabricInward: true, canIssueFabricOutward: true, canTransferFabricLot: true, canDeleteFabricLogs: true, canViewFabricPrices: true,
                                canCreateInvoices: true, canEditInvoiceRates: true, canCancelInvoices: true, canRecordPayments: true,
                                canCreateStitchingJobs: true, canIssueStitchingChallans: true, canManageWorkerRates: true
                              }))}
                              className="btn-secondary"
                              style={{ padding: '0.35rem 0.75rem', fontSize: '0.75rem', fontWeight: 700, color: '#1d4ed8', background: '#eff6ff', borderColor: '#bfdbfe' }}
                            >
                              Enable All
                            </button>
                            <button
                              type="button"
                              onClick={() => setFormData(p => ({
                                ...p,
                                canManageTasks: false, canBroadcastChat: false, canExportReports: false, canDeleteRecords: false, canViewFinancials: false,
                                canCreateJobCards: false, canEditJobCards: false, canDeleteJobCards: false, canAdvanceJobStage: false, canViewJobCosts: false,
                                canCreateDesigns: false, canInputNewDesign: false, canEditDesigns: false, canDeleteDesigns: false, canViewDesignCosts: false,
                                canAddFabricInward: false, canIssueFabricOutward: false, canTransferFabricLot: false, canDeleteFabricLogs: false, canViewFabricPrices: false,
                                canCreateInvoices: false, canEditInvoiceRates: false, canCancelInvoices: false, canRecordPayments: false,
                                canCreateStitchingJobs: false, canIssueStitchingChallans: false, canManageWorkerRates: false
                              }))}
                              className="btn-secondary"
                              style={{ padding: '0.35rem 0.75rem', fontSize: '0.75rem', fontWeight: 700, color: '#dc2626', background: '#fef2f2', borderColor: '#fecaca' }}
                            >
                              Disable All
                            </button>
                          </div>
                        </div>

                        {/* Section 1: System & General */}
                        <div style={{ background: '#ffffff', padding: '0.85rem 1rem', borderRadius: '10px', border: '1px solid #e2e8f0', boxShadow: '0 1px 3px rgba(0,0,0,0.02)' }}>
                          <div style={{ fontSize: '0.8rem', fontWeight: 800, color: '#334155', marginBottom: '0.6rem', display: 'flex', alignItems: 'center', gap: '6px' }}>
                            <span>🌟 System & General Operations</span>
                          </div>
                          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '0.5rem' }}>
                            <label style={styles.microLabel(formData.canManageTasks)}>
                              <input type="checkbox" checked={formData.canManageTasks} onChange={e => setFormData(p => ({ ...p, canManageTasks: e.target.checked }))} />
                              <span>📋 Task Creation & Assignment</span>
                            </label>
                            <label style={styles.microLabel(formData.canBroadcastChat)}>
                              <input type="checkbox" checked={formData.canBroadcastChat} onChange={e => setFormData(p => ({ ...p, canBroadcastChat: e.target.checked }))} />
                              <span>💬 Chat Broadcast Announcements</span>
                            </label>
                            <label style={styles.microLabel(formData.canExportReports)}>
                              <input type="checkbox" checked={formData.canExportReports} onChange={e => setFormData(p => ({ ...p, canExportReports: e.target.checked }))} />
                              <span>📥 Excel & PDF Report Export</span>
                            </label>
                            <label style={styles.microLabel(formData.canDeleteRecords)}>
                              <input type="checkbox" checked={formData.canDeleteRecords} onChange={e => setFormData(p => ({ ...p, canDeleteRecords: e.target.checked }))} />
                              <span>⚠️ Edit & Delete Master Data</span>
                            </label>
                            <label style={styles.microLabel(formData.canViewFinancials)}>
                              <input type="checkbox" checked={formData.canViewFinancials} onChange={e => setFormData(p => ({ ...p, canViewFinancials: e.target.checked }))} />
                              <span>💰 Purchase Cost & Margin Visibility</span>
                            </label>
                          </div>
                        </div>

                        {/* Section 2: Job Cards & Digital Print */}
                        <div style={{ background: '#ffffff', padding: '0.85rem 1rem', borderRadius: '10px', border: '1px solid #e2e8f0', boxShadow: '0 1px 3px rgba(0,0,0,0.02)' }}>
                          <div style={{ fontSize: '0.8rem', fontWeight: 800, color: '#2563eb', marginBottom: '0.6rem', display: 'flex', alignItems: 'center', gap: '6px' }}>
                            <span>📦 Digital Printing & Job Cards</span>
                          </div>
                          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '0.5rem' }}>
                            <label style={styles.microLabel(formData.canCreateJobCards)}>
                              <input type="checkbox" checked={formData.canCreateJobCards} onChange={e => setFormData(p => ({ ...p, canCreateJobCards: e.target.checked }))} />
                              <span>➕ Create New Job Cards</span>
                            </label>
                            <label style={styles.microLabel(formData.canEditJobCards)}>
                              <input type="checkbox" checked={formData.canEditJobCards} onChange={e => setFormData(p => ({ ...p, canEditJobCards: e.target.checked }))} />
                              <span>✏️ Edit Job Card Details</span>
                            </label>
                            <label style={styles.microLabel(formData.canAdvanceJobStage)}>
                              <input type="checkbox" checked={formData.canAdvanceJobStage} onChange={e => setFormData(p => ({ ...p, canAdvanceJobStage: e.target.checked }))} />
                              <span>⚡ Production Stage Transition</span>
                            </label>
                            <label style={styles.microLabel(formData.canViewJobCosts)}>
                              <input type="checkbox" checked={formData.canViewJobCosts} onChange={e => setFormData(p => ({ ...p, canViewJobCosts: e.target.checked }))} />
                              <span>💰 View Printing Costs & Margins</span>
                            </label>
                            <label style={styles.microLabel(formData.canDeleteJobCards)}>
                              <input type="checkbox" checked={formData.canDeleteJobCards} onChange={e => setFormData(p => ({ ...p, canDeleteJobCards: e.target.checked }))} />
                              <span>🗑️ Delete Job Cards</span>
                            </label>
                          </div>
                        </div>

                        {/* Section 3: Design Catalogue */}
                        <div style={{ background: '#ffffff', padding: '0.85rem 1rem', borderRadius: '10px', border: '1px solid #e2e8f0', boxShadow: '0 1px 3px rgba(0,0,0,0.02)' }}>
                          <div style={{ fontSize: '0.8rem', fontWeight: 800, color: '#0284c7', marginBottom: '0.6rem', display: 'flex', alignItems: 'center', gap: '6px' }}>
                            <span>🎨 Design Catalogue & Assets</span>
                          </div>
                          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '0.5rem' }}>
                            <label style={styles.microLabel(formData.canInputNewDesign)}>
                              <input type="checkbox" checked={formData.canInputNewDesign} onChange={e => setFormData(p => ({ ...p, canInputNewDesign: e.target.checked }))} />
                              <span>➕ "+ New Sample Design" Button & Upload</span>
                            </label>
                            <label style={styles.microLabel(formData.canCreateDesigns)}>
                              <input type="checkbox" checked={formData.canCreateDesigns} onChange={e => setFormData(p => ({ ...p, canCreateDesigns: e.target.checked }))} />
                              <span>🎨 Create & Upload Catalog Designs</span>
                            </label>
                            <label style={styles.microLabel(formData.canEditDesigns)}>
                              <input type="checkbox" checked={formData.canEditDesigns} onChange={e => setFormData(p => ({ ...p, canEditDesigns: e.target.checked }))} />
                              <span>✏️ Edit Design & Swap Images</span>
                            </label>
                            <label style={styles.microLabel(formData.canViewDesignCosts)}>
                              <input type="checkbox" checked={formData.canViewDesignCosts} onChange={e => setFormData(p => ({ ...p, canViewDesignCosts: e.target.checked }))} />
                              <span>💵 View Design Meter Costs</span>
                            </label>
                            <label style={styles.microLabel(formData.canDeleteDesigns)}>
                              <input type="checkbox" checked={formData.canDeleteDesigns} onChange={e => setFormData(p => ({ ...p, canDeleteDesigns: e.target.checked }))} />
                              <span>🗑️ Delete Designs</span>
                            </label>
                          </div>
                        </div>

                        {/* Section 4: Fabric Inventory */}
                        <div style={{ background: '#ffffff', padding: '0.85rem 1rem', borderRadius: '10px', border: '1px solid #e2e8f0', boxShadow: '0 1px 3px rgba(0,0,0,0.02)' }}>
                          <div style={{ fontSize: '0.8rem', fontWeight: 800, color: '#16a34a', marginBottom: '0.6rem', display: 'flex', alignItems: 'center', gap: '6px' }}>
                            <span>🧵 Fabric Inventory & Stock Control</span>
                          </div>
                          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '0.5rem' }}>
                            <label style={styles.microLabel(formData.canAddFabricInward)}>
                              <input type="checkbox" checked={formData.canAddFabricInward} onChange={e => setFormData(p => ({ ...p, canAddFabricInward: e.target.checked }))} />
                              <span>📥 Inward Fabric Rolls & Lots</span>
                            </label>
                            <label style={styles.microLabel(formData.canIssueFabricOutward)}>
                              <input type="checkbox" checked={formData.canIssueFabricOutward} onChange={e => setFormData(p => ({ ...p, canIssueFabricOutward: e.target.checked }))} />
                              <span>📦 Issue Fabric Outward</span>
                            </label>
                            <label style={styles.microLabel(formData.canTransferFabricLot)}>
                              <input type="checkbox" checked={formData.canTransferFabricLot} onChange={e => setFormData(p => ({ ...p, canTransferFabricLot: e.target.checked }))} />
                              <span>🔄 Lot Stock Transfers & Rebalance</span>
                            </label>
                            <label style={styles.microLabel(formData.canViewFabricPrices)}>
                              <input type="checkbox" checked={formData.canViewFabricPrices} onChange={e => setFormData(p => ({ ...p, canViewFabricPrices: e.target.checked }))} />
                              <span>🏷️ View Supplier Fabric Prices</span>
                            </label>
                            <label style={styles.microLabel(formData.canDeleteFabricLogs)}>
                              <input type="checkbox" checked={formData.canDeleteFabricLogs} onChange={e => setFormData(p => ({ ...p, canDeleteFabricLogs: e.target.checked }))} />
                              <span>🗑️ Delete Inventory Logs</span>
                            </label>
                          </div>
                        </div>

                        {/* Section 5: Billing & Invoicing */}
                        <div style={{ background: '#ffffff', padding: '0.85rem 1rem', borderRadius: '10px', border: '1px solid #e2e8f0', boxShadow: '0 1px 3px rgba(0,0,0,0.02)' }}>
                          <div style={{ fontSize: '0.8rem', fontWeight: 800, color: '#7c3aed', marginBottom: '0.6rem', display: 'flex', alignItems: 'center', gap: '6px' }}>
                            <span>🧾 Billing, Invoices & GST Accounts</span>
                          </div>
                          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '0.5rem' }}>
                            <label style={styles.microLabel(formData.canCreateInvoices)}>
                              <input type="checkbox" checked={formData.canCreateInvoices} onChange={e => setFormData(p => ({ ...p, canCreateInvoices: e.target.checked }))} />
                              <span>🧾 Generate Tax Invoices & Challans</span>
                            </label>
                            <label style={styles.microLabel(formData.canEditInvoiceRates)}>
                              <input type="checkbox" checked={formData.canEditInvoiceRates} onChange={e => setFormData(p => ({ ...p, canEditInvoiceRates: e.target.checked }))} />
                              <span>✏️ Edit Billed Rates & Discounts</span>
                            </label>
                            <label style={styles.microLabel(formData.canRecordPayments)}>
                              <input type="checkbox" checked={formData.canRecordPayments} onChange={e => setFormData(p => ({ ...p, canRecordPayments: e.target.checked }))} />
                              <span>💳 Record Payment Receipts</span>
                            </label>
                            <label style={styles.microLabel(formData.canCancelInvoices)}>
                              <input type="checkbox" checked={formData.canCancelInvoices} onChange={e => setFormData(p => ({ ...p, canCancelInvoices: e.target.checked }))} />
                              <span>🚫 Cancel / Void Tax Invoices</span>
                            </label>
                          </div>
                        </div>

                        {/* Section 6: Stitching */}
                        <div style={{ background: '#ffffff', padding: '0.85rem 1rem', borderRadius: '10px', border: '1px solid #e2e8f0', boxShadow: '0 1px 3px rgba(0,0,0,0.02)' }}>
                          <div style={{ fontSize: '0.8rem', fontWeight: 800, color: '#ea580c', marginBottom: '0.6rem', display: 'flex', alignItems: 'center', gap: '6px' }}>
                            <span>✂️ Garment Stitching Department</span>
                          </div>
                          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '0.5rem' }}>
                            <label style={styles.microLabel(formData.canCreateStitchingJobs)}>
                              <input type="checkbox" checked={formData.canCreateStitchingJobs} onChange={e => setFormData(p => ({ ...p, canCreateStitchingJobs: e.target.checked }))} />
                              <span>✂️ Create Stitching Job Cards</span>
                            </label>
                            <label style={styles.microLabel(formData.canIssueStitchingChallans)}>
                              <input type="checkbox" checked={formData.canIssueStitchingChallans} onChange={e => setFormData(p => ({ ...p, canIssueStitchingChallans: e.target.checked }))} />
                              <span>📜 Issue Cutting & Stitching Challans</span>
                            </label>
                            <label style={styles.microLabel(formData.canManageWorkerRates)}>
                              <input type="checkbox" checked={formData.canManageWorkerRates} onChange={e => setFormData(p => ({ ...p, canManageWorkerRates: e.target.checked }))} />
                              <span>💰 Manage Piece-Rate Worker Wages</span>
                            </label>
                          </div>
                        </div>
                      </div>
                    )}

                    {/* ========================================================= */}
                    {/* TAB 3: FUNCTIONALITY ACCESS & ALLOWED SCREENS             */}
                    {/* ========================================================= */}
                    {modalTab === 'screens' && (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                        {/* Screens Header */}
                        <div style={{
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          flexWrap: 'wrap',
                          gap: '0.6rem',
                          background: '#f8fafc',
                          padding: '0.85rem 1rem',
                          borderRadius: '10px',
                          border: '1px solid #cbd5e1'
                        }}>
                          <div>
                            <div style={{ fontSize: '0.85rem', fontWeight: 800, color: '#1d4ed8', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                              🖥️ Allowed Screen Modules & Navigation
                            </div>
                            <p style={{ fontSize: '0.74rem', color: '#64748b', margin: '2px 0 0 0' }}>
                              Select which operational modules and screens this user is authorized to open in the interface.
                            </p>
                          </div>
                          {formData.role !== 'admin' && (
                            <div style={{ display: 'flex', gap: '0.45rem' }}>
                              <button
                                type="button"
                                onClick={() => setFormData(p => ({ ...p, permissions: AVAILABLE_SCREENS.map(s => s.id) }))}
                                className="btn-secondary"
                                style={{ padding: '0.35rem 0.75rem', fontSize: '0.75rem', fontWeight: 700, color: '#1d4ed8', background: '#eff6ff', borderColor: '#bfdbfe' }}
                              >
                                Select All
                              </button>
                              <button
                                type="button"
                                onClick={() => setFormData(p => ({ ...p, permissions: [] }))}
                                className="btn-secondary"
                                style={{ padding: '0.35rem 0.75rem', fontSize: '0.75rem', fontWeight: 700, color: '#dc2626', background: '#fef2f2', borderColor: '#fecaca' }}
                              >
                                Clear All
                              </button>
                            </div>
                          )}
                        </div>

                        {/* Real-Time Permission Search Filter */}
                        <div style={{ position: 'relative' }}>
                          <Search size={15} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: '#64748b' }} />
                          <input
                            type="text"
                            placeholder="Search screens & buttons (e.g. 'sample design', 'catalog', 'inward')..."
                            value={permissionSearchTerm}
                            onChange={e => setPermissionSearchTerm(e.target.value)}
                            style={{
                              width: '100%',
                              padding: '0.55rem 2.2rem 0.55rem 2.4rem',
                              borderRadius: '8px',
                              border: '1px solid #cbd5e1',
                              fontSize: '16px',
                              minHeight: '44px',
                              boxSizing: 'border-box',
                              background: '#ffffff',
                              outline: 'none',
                              boxShadow: '0 1px 2px rgba(0,0,0,0.03)'
                            }}
                          />
                          {permissionSearchTerm && (
                            <button
                              type="button"
                              onClick={() => setPermissionSearchTerm('')}
                              style={{
                                position: 'absolute',
                                right: 10,
                                top: '50%',
                                transform: 'translateY(-50%)',
                                background: 'none',
                                border: 'none',
                                color: '#94a3b8',
                                cursor: 'pointer',
                                padding: 2
                              }}
                            >
                              <X size={15} />
                            </button>
                          )}
                        </div>

                        {(() => {
                          const term = permissionSearchTerm.trim().toLowerCase();
                          const matchingScreens = term
                            ? AVAILABLE_SCREENS.filter(s =>
                                s.label.toLowerCase().includes(term) ||
                                s.id.toLowerCase().includes(term) ||
                                s.category.toLowerCase().includes(term) ||
                                (s.id === 'jobcards_sample' && 'new sample design'.includes(term))
                              )
                            : AVAILABLE_SCREENS;

                          const categories = Array.from(new Set(matchingScreens.map(s => s.category)));

                          if (categories.length === 0) {
                            return (
                              <div style={{ padding: '2rem', textAlign: 'center', color: '#64748b', fontSize: '0.85rem', background: '#f8fafc', borderRadius: '10px', border: '1px solid #e2e8f0' }}>
                                No screens found matching "{permissionSearchTerm}".
                              </div>
                            );
                          }

                          return categories.map(cat => {
                            const catScreens = matchingScreens.filter(s => s.category === cat);
                            const allChecked = catScreens.every(s => formData.permissions.includes(s.id));
                            const catTitle = cat === 'General' ? '⚙️ Core & General' :
                                             cat === 'Elite Online' ? '🏪 Elite Online (E-Commerce)' :
                                             cat === 'Elite Edition' ? '🏢 Elite Edition' :
                                             cat === 'Elite Fabtex' ? '🏭 Elite Fabtex' :
                                             cat === 'Elite Digital Print' ? '🖨️ Elite Digital Print' :
                                             cat === 'Elite Stitching' ? '✂️ Elite Stitching' : `📁 ${cat}`;

                            return (
                              <div key={cat} style={{ background: '#f8fafc', padding: '0.85rem 1rem', borderRadius: '10px', border: '1px solid #cbd5e1' }}>
                                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.65rem' }}>
                                  <span style={{ fontSize: '0.8rem', fontWeight: 800, color: '#1d4ed8', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                                    {catTitle} ({catScreens.filter(s => formData.permissions.includes(s.id)).length} / {catScreens.length})
                                  </span>
                                  {formData.role !== 'admin' && (
                                    <button
                                      type="button"
                                      onClick={() => {
                                        const ids = catScreens.map(s => s.id);
                                        setFormData(prev => {
                                          const hasAll = ids.every(id => prev.permissions.includes(id));
                                          const updated = hasAll
                                            ? prev.permissions.filter(id => !ids.includes(id))
                                            : Array.from(new Set([...prev.permissions, ...ids]));
                                          return { ...prev, permissions: updated };
                                        });
                                      }}
                                      style={{ background: 'none', border: 'none', color: '#2563eb', fontSize: '0.74rem', cursor: 'pointer', fontWeight: 700, textDecoration: 'underline' }}
                                    >
                                      {allChecked ? 'Deselect Category' : 'Select Category'}
                                    </button>
                                  )}
                                </div>

                                <div style={styles.checkboxGrid}>
                                  {catScreens.map(screen => {
                                    const isChecked = formData.permissions.includes(screen.id);
                                    const isSample = screen.id === 'jobcards_sample';
                                    return (
                                      <label
                                        key={screen.id}
                                        style={{
                                          ...styles.checkboxLabel,
                                          background: isChecked ? '#eff6ff' : isSample ? '#fffbeb' : '#ffffff',
                                          borderColor: isChecked ? '#2563eb' : isSample ? '#f59e0b' : '#cbd5e1',
                                          boxShadow: isChecked ? '0 1px 3px rgba(37,99,235,0.08)' : 'none',
                                          ...(formData.role === 'admin' ? styles.checkboxLabelDisabled : {})
                                        }}
                                      >
                                        <input
                                          type="checkbox"
                                          checked={isChecked}
                                          disabled={formData.role === 'admin'}
                                          onChange={() => handlePermissionCheckbox(screen.id)}
                                          style={styles.checkbox}
                                        />
                                        <span style={{ fontSize: '0.82rem', fontWeight: isChecked || isSample ? 700 : 500, color: isChecked ? '#1d4ed8' : isSample ? '#92400e' : '#334155' }}>
                                          {screen.label}
                                        </span>
                                      </label>
                                    );
                                  })}
                                </div>
                              </div>
                            );
                          });
                        })()}
                      </div>
                    )}
                  </div>

                  {/* Modal Footer Actions (Sticky Bottom with Safe Area Clearance) */}
                  <div style={{
                    padding: isMobile
                      ? '0.75rem 1rem calc(0.75rem + env(safe-area-inset-bottom, 0px)) 1rem'
                      : '1.1rem 1.6rem',
                    background: '#f8fafc',
                    borderTop: '1px solid #e2e8f0',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: '0.75rem',
                    flexWrap: 'wrap',
                    flexShrink: 0
                  }}>
                    {/* Left side: Tab navigation shortcuts */}
                    <div style={{ display: 'flex', gap: '0.5rem', width: isMobile ? '100%' : 'auto' }}>
                      {modalTab === 'profile' && (
                        <button
                          type="button"
                          onClick={() => setModalTab('privileges')}
                          className="btn-secondary"
                          style={{ padding: '0.5rem 1rem', fontSize: '0.82rem', fontWeight: 700, borderRadius: '7px', flex: isMobile ? 1 : 'none' }}
                        >
                          <span>Next: Operational Privileges &rarr;</span>
                        </button>
                      )}
                      {modalTab === 'privileges' && (
                        <div style={{ display: 'flex', gap: '0.5rem', width: isMobile ? '100%' : 'auto', flex: 1 }}>
                          <button
                            type="button"
                            onClick={() => setModalTab('profile')}
                            className="btn-secondary"
                            style={{ padding: '0.5rem 0.9rem', fontSize: '0.82rem', fontWeight: 700, borderRadius: '7px', flex: isMobile ? 1 : 'none' }}
                          >
                            <span>&larr; Profile</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => setModalTab('screens')}
                            className="btn-secondary"
                            style={{ padding: '0.5rem 1rem', fontSize: '0.82rem', fontWeight: 700, borderRadius: '7px', flex: isMobile ? 1 : 'none' }}
                          >
                            <span>Next: Screen Access &rarr;</span>
                          </button>
                        </div>
                      )}
                      {modalTab === 'screens' && (
                        <button
                          type="button"
                          onClick={() => setModalTab('privileges')}
                          className="btn-secondary"
                          style={{ padding: '0.5rem 0.9rem', fontSize: '0.82rem', fontWeight: 700, borderRadius: '7px', flex: isMobile ? 1 : 'none' }}
                        >
                          <span>&larr; Operational Privileges</span>
                        </button>
                      )}
                    </div>

                    {/* Right side: Cancel & Save Buttons */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', width: isMobile ? '100%' : 'auto' }}>
                      <button
                        type="button"
                        onClick={handleCancelEdit}
                        className="btn-secondary"
                        style={{ padding: '0.55rem 1.2rem', fontSize: '0.85rem', fontWeight: 700, borderRadius: '7px', flex: isMobile ? 1 : 'none' }}
                      >
                        <X size={15} />
                        <span>Cancel</span>
                      </button>
                      <button
                        type="submit"
                        className="btn-primary"
                        style={{
                          padding: '0.55rem 1.5rem',
                          fontSize: '0.85rem',
                          fontWeight: 700,
                          borderRadius: '7px',
                          background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
                          boxShadow: '0 4px 14px rgba(16, 185, 129, 0.3)',
                          display: 'inline-flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          gap: '0.45rem',
                          cursor: 'pointer',
                          flex: isMobile ? 2 : 'none'
                        }}
                        disabled={submitLoading}
                      >
                        {submitLoading ? (
                          <RotateCw size={15} className="spin-loader" />
                        ) : (
                          <Save size={15} />
                        )}
                        <span>{editingUser ? 'Save Changes' : 'Create User Account'}</span>
                      </button>
                    </div>
                  </div>
                </form>
              </div>
            </div>
          )}
        </div>
      )}

      {activeSubTab === 'billing' && (
        <div style={styles.contentLayout}>
          {/* Left Side: Bills List */}
          <div className="glass-panel" style={styles.tablePanel}>
            <div style={styles.panelHeader}>
              <CreditCard size={16} color="var(--primary)" />
              <h3 style={styles.panelTitle}>Monthly Bills History</h3>
              {billsLoading && <RotateCw size={14} className="spin-loader" style={{ marginLeft: 'auto', color: 'var(--text-muted)' }} />}
            </div>

            <div className="table-container" style={styles.tableWrap}>
              {billsLoading && bills.length === 0 ? (
                <div style={styles.emptyState}>
                  <RotateCw size={24} className="spin-loader" color="var(--primary)" />
                  <p style={{ marginTop: '0.5rem', color: 'var(--text-muted)' }}>Loading billing history...</p>
                </div>
              ) : bills.length === 0 ? (
                <div style={styles.emptyState}>
                  <CreditCard size={28} color="var(--text-muted)" />
                  <p style={{ marginTop: '0.5rem', color: 'var(--text-muted)' }}>No billing records registered yet.</p>
                </div>
              ) : (
                <table>
                  <thead>
                    <tr>
                      <th>Sr. No.</th>
                      <th>Month</th>
                      <th className="text-right">AWS Amount</th>
                      <th className="text-right">MongoDB Amount</th>
                      <th className="text-right">Total Amount</th>
                      <th>Notes</th>
                      <th className="text-center">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {bills.map((b, idx) => (
                      <tr key={b._id || b.id}>
                        <td>{idx + 1}</td>
                        <td>
                          <span style={{ fontWeight: '600', color: 'var(--text-primary)' }}>{b.month}</span>
                        </td>
                        <td className="text-right" style={{ color: 'var(--text-primary)' }}>Rs. {Number(b.awsAmount || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                        <td className="text-right" style={{ color: 'var(--text-primary)' }}>Rs. {Number(b.mongoDbAmount || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                        <td className="text-right" style={{ fontWeight: '700', color: 'var(--primary)' }}>Rs. {Number(b.totalAmount || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                        <td style={{ fontSize: '0.8rem', color: 'var(--text-muted)', maxWidth: '150px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={b.notes}>{b.notes || '—'}</td>
                        <td>
                          <div style={styles.actionsCell}>
                            <button
                              onClick={() => handleEditBillClick(b)}
                              className="btn-icon"
                              title="Edit Bill"
                            >
                              <Edit2 size={14} />
                            </button>
                            <button
                              onClick={() => handleDeleteBill(b)}
                              className="btn-icon"
                              style={styles.trashBtn}
                              title="Delete Bill"
                            >
                              <Trash2 size={14} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>

          {/* Right Side: Add/Edit Bill Form */}
          <div className="glass-panel" style={styles.formPanel}>
            <div style={styles.panelHeader}>
              <UserPlus size={16} color="var(--primary)" />
              <h3 style={styles.panelTitle}>
                {editingBill ? `Edit Billing Record — ${editingBill.month}` : 'Add Monthly Bill'}
              </h3>
            </div>

            <form onSubmit={handleBillSubmit} style={styles.form}>
              <div style={styles.formGroup}>
                <label style={styles.label}>Month *</label>
                <div style={styles.inputWrapper}>
                  <input
                    type="text"
                    name="month"
                    value={billFormData.month}
                    onChange={e => setBillFormData(p => ({ ...p, month: e.target.value }))}
                    placeholder="e.g. June 2026"
                    required
                    style={styles.formInputWithoutIcon}
                  />
                </div>
              </div>

              <div style={styles.formGroup}>
                <label style={styles.label}>AWS Amount (Rs.) *</label>
                <div style={styles.inputWrapper}>
                  <input
                    type="number"
                    min="0"
                    step="any"
                    name="awsAmount"
                    value={billFormData.awsAmount}
                    onChange={e => setBillFormData(p => ({ ...p, awsAmount: e.target.value }))}
                    placeholder="e.g. 2169.78"
                    required
                    style={styles.formInputWithoutIcon}
                  />
                </div>
              </div>

              <div style={styles.formGroup}>
                <label style={styles.label}>MongoDB Amount (Rs.) *</label>
                <div style={styles.inputWrapper}>
                  <input
                    type="number"
                    min="0"
                    step="any"
                    name="mongoDbAmount"
                    value={billFormData.mongoDbAmount}
                    onChange={e => setBillFormData(p => ({ ...p, mongoDbAmount: e.target.value }))}
                    placeholder="e.g. 0.00"
                    required
                    style={styles.formInputWithoutIcon}
                  />
                </div>
              </div>

              <div style={styles.formGroup}>
                <label style={styles.label}>Notes</label>
                <textarea
                  name="notes"
                  value={billFormData.notes}
                  onChange={e => setBillFormData(p => ({ ...p, notes: e.target.value }))}
                  placeholder="Add any billing context or invoices details..."
                  style={{
                    ...styles.formInputWithoutIcon,
                    minHeight: '80px',
                    background: 'rgba(17, 24, 39, 0.7)',
                    border: '1px solid var(--border-light)',
                    color: 'var(--text-primary)',
                    borderRadius: 'var(--radius-sm)',
                    padding: '0.65rem 0.75rem',
                    outline: 'none',
                    resize: 'vertical'
                  }}
                />
              </div>

              <div style={styles.formActions}>
                {editingBill && (
                  <button
                    type="button"
                    onClick={handleCancelBillEdit}
                    className="btn-secondary"
                    style={styles.btn}
                  >
                    <X size={14} />
                    <span>Cancel</span>
                  </button>
                )}
                <button
                  type="submit"
                  className="btn-success"
                  style={{ ...styles.btn, ...styles.submitBtn }}
                  disabled={submitLoading}
                >
                  {submitLoading ? (
                    <RotateCw size={14} className="spin-loader" />
                  ) : (
                    <Save size={14} />
                  )}
                  <span>{editingBill ? 'Save Changes' : 'Log Bill'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {activeSubTab === 'backup' && (
        <div className="glass-panel" style={{ padding: '1.75rem', borderRadius: '12px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1.25rem', borderBottom: '1px solid var(--border-color)', paddingBottom: '1rem' }}>
            <Database size={24} color="var(--primary)" />
            <div>
              <h3 style={{ margin: 0, fontSize: '1.15rem', fontWeight: 600 }}>System Data Backup & Export</h3>
              <p style={{ margin: '0.2rem 0 0 0', fontSize: '0.83rem', color: 'var(--text-muted)' }}>
                Export comprehensive system data filtered by department and custom start/end date ranges.
              </p>
            </div>
          </div>

          <form onSubmit={handleDownloadBackup} style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '1.25rem', marginTop: '1rem' }}>
            {/* Start Date */}
            <div style={styles.formGroup}>
              <label style={styles.label}>Start Date (Optional)</label>
              <div style={styles.inputWrapper}>
                <Calendar size={14} style={styles.inputIcon} />
                <input
                  type="date"
                  value={backupForm.startDate}
                  onChange={(e) => setBackupForm(prev => ({ ...prev, startDate: e.target.value }))}
                  style={styles.formInput}
                />
              </div>
            </div>

            {/* End Date */}
            <div style={styles.formGroup}>
              <label style={styles.label}>End Date (Optional)</label>
              <div style={styles.inputWrapper}>
                <Calendar size={14} style={styles.inputIcon} />
                <input
                  type="date"
                  value={backupForm.endDate}
                  onChange={(e) => setBackupForm(prev => ({ ...prev, endDate: e.target.value }))}
                  style={styles.formInput}
                />
              </div>
            </div>

            {/* Department Select */}
            <div style={styles.formGroup}>
              <label style={styles.label}>Select Department *</label>
              <div style={styles.inputWrapper}>
                <Layers size={14} style={styles.inputIcon} />
                <select
                  value={backupForm.department}
                  onChange={(e) => setBackupForm(prev => ({ ...prev, department: e.target.value }))}
                  style={styles.formInput}
                >
                  <option value="all">⚡ All Departments (Full System Backup)</option>
                  <option value="billing">🧾 Billing & Invoicing</option>
                  <option value="design">🎨 Design Room</option>
                  <option value="digital_printing">🖨️ Digital Printing (Job Cards & Logs)</option>
                  <option value="fabric">🧵 Fabric Inventory & Stock</option>
                  <option value="stitching">🪡 Stitching Department</option>
                  <option value="garment">👔 Garment Job Cards</option>
                  <option value="sales">🛒 E-Commerce Sales & Catalog</option>
                  <option value="customers">👥 Customers & Vendors Master</option>
                </select>
              </div>
            </div>

            {/* File Format */}
            <div style={styles.formGroup}>
              <label style={styles.label}>Export File Format *</label>
              <div style={styles.inputWrapper}>
                <FileSpreadsheet size={14} style={styles.inputIcon} />
                <select
                  value={backupForm.format}
                  onChange={(e) => setBackupForm(prev => ({ ...prev, format: e.target.value }))}
                  style={styles.formInput}
                >
                  <option value="json">JSON Data Archive (.json)</option>
                  <option value="csv">CSV Spreadsheet (.csv)</option>
                </select>
              </div>
            </div>

            {/* Download Button */}
            <div style={{ gridColumn: '1 / -1', display: 'flex', justifyContent: 'flex-end', marginTop: '0.5rem' }}>
              <button
                type="submit"
                className="btn-primary"
                disabled={backupLoading}
                style={{ padding: '0.7rem 1.8rem', fontSize: '0.9rem', display: 'inline-flex', alignItems: 'center', gap: '0.5rem' }}
              >
                {backupLoading ? <RotateCw size={16} className="spin-loader" /> : <Download size={16} />}
                <span>{backupLoading ? 'Generating Backup File...' : 'Download Data Backup'}</span>
              </button>
            </div>
          </form>
        </div>
      )}

      {activeSubTab === 'approvals' && (
        <AdminChangeApprovalQueue onCountChange={setPendingApprovalsCount} />
      )}

      {activeSubTab === 'dataReview' && (
        <AdminUserDataReview />
      )}

      {activeSubTab === 'settings' && (
        <PrintSettings expenseOnly={true} />
      )}

      {activeSubTab === 'signedDocs' && (
        <AdminSignedDocumentsApproval />
      )}

      {activeSubTab === 'clients' && (
        <AdminClientDetails />
      )}

    </div>
  );
}

const styles = {
  container: {
    display: 'flex',
    flexDirection: 'column',
    gap: '1.5rem',
    width: '100%',
    maxWidth: '1350px',
    margin: '0 auto',
  },
  topBar: {
    padding: '1rem 1.5rem',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
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
    margin: 0
  },
  pageSubtitle: {
    fontSize: '0.85rem',
    color: 'var(--text-muted)',
    margin: '2px 0 0 0'
  },
  contentLayout: {
    display: 'grid',
    gridTemplateColumns: '1.5fr 1fr',
    gap: '1.5rem',
    alignItems: 'start'
  },
  tablePanel: {
    padding: '1.5rem',
    minHeight: '450px',
    display: 'flex',
    flexDirection: 'column',
    gap: '1rem'
  },
  formPanel: {
    padding: '1.5rem',
    display: 'flex',
    flexDirection: 'column',
    gap: '1.2rem'
  },
  panelHeader: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.5rem',
    borderBottom: '1px solid var(--border-light)',
    paddingBottom: '0.75rem'
  },
  panelTitle: {
    fontSize: '1rem',
    fontWeight: '600',
    color: 'var(--text-primary)',
    margin: 0
  },
  tableWrap: {
    flex: 1,
    minWidth: 0,
    width: '100%',
    maxWidth: '100%',
    overflowX: 'auto',
    WebkitOverflowScrolling: 'touch'
  },
  avatar: (isAdmin) => ({
    width: '32px',
    height: '32px',
    borderRadius: '50%',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: '0.85rem',
    fontWeight: '800',
    color: '#ffffff',
    boxShadow: isAdmin ? '0 2px 8px rgba(220, 38, 38, 0.25)' : '0 2px 8px rgba(37, 99, 235, 0.25)',
    background: isAdmin
      ? 'linear-gradient(135deg, #ef4444 0%, #dc2626 100%)'
      : 'linear-gradient(135deg, #2563eb 0%, #7c3aed 100%)'
  }),
  permissionsList: {
    display: 'flex',
    gap: '0.3rem',
    flexWrap: 'wrap',
    maxWidth: '320px'
  },
  permissionBadge: {
    fontSize: '0.7rem',
    fontWeight: 600,
    background: '#eff6ff',
    border: '1px solid #bfdbfe',
    color: '#1d4ed8',
    padding: '0.15rem 0.45rem',
    borderRadius: '4px'
  },
  adminAllBadge: {
    fontSize: '0.72rem',
    background: '#fee2e2',
    border: '1px solid #fca5a5',
    color: '#dc2626',
    padding: '0.15rem 0.55rem',
    borderRadius: '4px',
    fontWeight: '800',
    letterSpacing: '0.02em'
  },
  noScreensBadge: {
    fontSize: '0.7rem',
    background: '#f1f5f9',
    border: '1px solid #cbd5e1',
    color: '#64748b',
    padding: '0.15rem 0.45rem',
    borderRadius: '4px',
    fontWeight: 600
  },
  actionsCell: {
    display: 'flex',
    gap: '0.4rem',
    justifyContent: 'center'
  },
  trashBtn: {
    color: '#dc2626',
    borderColor: '#fecaca',
    background: '#fef2f2'
  },
  emptyState: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '4rem 1rem',
    textAlign: 'center'
  },
  form: {
    display: 'flex',
    flexDirection: 'column',
    gap: '1.1rem'
  },
  formGroup: {
    display: 'flex',
    flexDirection: 'column',
    gap: '0.35rem'
  },
  label: {
    fontSize: '0.82rem',
    fontWeight: '700',
    color: '#1e293b',
    marginLeft: '2px'
  },
  inputWrapper: {
    position: 'relative',
    display: 'flex',
    alignItems: 'center'
  },
  inputIcon: {
    position: 'absolute',
    left: '0.75rem',
    color: '#64748b'
  },
  formInput: {
    width: '100%',
    paddingLeft: '2.2rem',
    background: '#ffffff',
    border: '1px solid #cbd5e1',
    color: '#0f172a',
    borderRadius: '6px',
    fontSize: '16px',
    minHeight: '44px'
  },
  formInputWithoutIcon: {
    width: '100%',
    background: '#ffffff',
    border: '1px solid #cbd5e1',
    color: '#0f172a',
    borderRadius: '6px',
    fontSize: '16px',
    minHeight: '44px'
  },
  selectInput: {
    width: '100%',
    padding: '0.65rem 0.75rem',
    background: '#ffffff',
    border: '1px solid #cbd5e1',
    color: '#0f172a',
    borderRadius: '6px',
    fontSize: '16px',
    minHeight: '44px',
    fontWeight: 600,
    outline: 'none',
  },
  helpText: {
    fontSize: '0.72rem',
    color: '#64748b',
    margin: '0 0 0.25rem 2px',
    fontWeight: 500
  },
  microLabel: (checked) => ({
    display: 'flex',
    alignItems: 'center',
    gap: '0.45rem',
    background: checked ? '#f0f9ff' : '#ffffff',
    padding: '0.4rem 0.55rem',
    borderRadius: '6px',
    border: checked ? '1px solid #93c5fd' : '1px solid #e2e8f0',
    fontSize: '0.74rem',
    cursor: 'pointer',
    fontWeight: checked ? 700 : 500,
    color: checked ? '#1e40af' : '#334155',
    transition: 'all 0.15s ease'
  }),
  checkboxGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))',
    gap: '0.5rem',
  },
  checkboxLabel: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.5rem',
    cursor: 'pointer',
    padding: '0.45rem 0.6rem',
    borderRadius: '6px',
    border: '1px solid #e2e8f0',
    transition: 'all 0.15s ease',
    userSelect: 'none'
  },
  checkboxLabelDisabled: {
    opacity: 0.5,
    cursor: 'not-allowed'
  },
  checkbox: {
    cursor: 'pointer',
    accentColor: '#2563eb',
    width: '15px',
    height: '15px'
  },
  formActions: {
    display: 'flex',
    justifyContent: 'flex-end',
    gap: '0.75rem',
    marginTop: '0.5rem'
  },
  btn: {
    padding: '0.6rem 1.2rem',
    display: 'inline-flex',
    alignItems: 'center',
    gap: '0.4rem',
    fontSize: '0.85rem',
    borderRadius: '6px',
    fontWeight: 700
  },
  submitBtn: {
    flex: 1,
    justifyContent: 'center'
  },
  errorBox: {
    background: '#fef2f2',
    border: '1px solid #fecaca',
    borderRadius: '6px',
    padding: '0.65rem 0.75rem',
    color: '#dc2626',
    fontWeight: 700,
    fontSize: '0.82rem'
  },
  successBox: {
    background: '#f0fdf4',
    border: '1px solid #bbf7d0',
    borderRadius: '6px',
    padding: '0.65rem 0.75rem',
    color: '#16a34a',
    fontWeight: 700,
    fontSize: '0.82rem'
  }
};