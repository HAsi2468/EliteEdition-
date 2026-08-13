import { triggerPushNotification } from '../components/NotificationToast';
import { api } from './api';

export const SCREEN_GROUPS = {
  jobcards: {
    id: 'jobcards',
    name: '[EDP] Job Cards',
    deptShort: 'EDP',
    screenName: 'Job Cards',
    permissionKeys: ['jobcards', 'jobcards_list', 'stitching_jobcards'],
    description: 'Digital Printing & Production Job Cards Group'
  },
  jobcards_fabric: {
    id: 'jobcards_fabric',
    name: '[EDP] Fabric Inventory',
    deptShort: 'EDP',
    screenName: 'Fabric Inventory',
    permissionKeys: ['jobcards_fabric', 'jobcards_stitching_challan', 'stitching_fabric'],
    description: 'Fabric Inward, Outward & Dispatch Challans Group'
  },
  jobcards_billing: {
    id: 'jobcards_billing',
    name: '[EDP] Billing & Invoicing',
    deptShort: 'EDP',
    screenName: 'Billing & Invoicing',
    permissionKeys: ['jobcards_billing', 'invoices'],
    description: 'GST Invoicing, Accounts & Receivables Group'
  },
  jobcards_catalogue: {
    id: 'jobcards_catalogue',
    name: '[EDP] Design Room',
    deptShort: 'EDP',
    screenName: 'Design Room',
    permissionKeys: ['jobcards_catalogue', 'stitching_design'],
    description: 'Design Library, Master Assets & Patterns Group'
  },
  stitching_department: {
    id: 'stitching_department',
    name: '[ST] Stitching Department',
    deptShort: 'ST',
    screenName: 'Stitching Department',
    permissionKeys: ['stitching_jobcards', 'stitching_fabric', 'stitching_design'],
    description: 'Stitching Production & Fabric Challans Group'
  },
  inventory: {
    id: 'inventory',
    name: '[EE] E-Commerce Inventory',
    deptShort: 'EE',
    screenName: 'E-Commerce Inventory',
    permissionKeys: ['inventory', 'catalog', 'sales'],
    description: 'Elite Edition Online Inventory & Dispatch Group'
  }
};

export const getScreenGroupInfo = (screenId, allUsers = []) => {
  const group = SCREEN_GROUPS[screenId] || {
    id: screenId,
    name: 'Operations Team Group',
    permissionKeys: [screenId],
    description: 'Screen Operations Group'
  };

  const currentLoggedInUser = api.getCurrentUser();
  const admins = [];
  const members = [];

  const targetUsers = Array.isArray(allUsers) && allUsers.length > 0
    ? allUsers
    : [currentLoggedInUser].filter(Boolean);

  targetUsers.forEach(u => {
    if (!u) return;
    const isAdmin = u.role === 'admin';
    const userPerms = Array.isArray(u.permissions) ? u.permissions : [];
    const hasPermission = isAdmin || group.permissionKeys.some(pk => userPerms.includes(pk));

    if (isAdmin) {
      if (!admins.some(a => a.username === u.username)) admins.push(u);
    }
    if (hasPermission) {
      if (!members.some(m => m.username === u.username)) members.push(u);
    }
  });

  return {
    group,
    admins,
    members,
    totalCount: members.length
  };
};

export const dispatchScreenGroupEvent = (screenId, title, message, actionTab = null) => {
  const group = SCREEN_GROUPS[screenId] || { name: 'Operations Group' };
  const currentUser = api.getCurrentUser();
  const creatorName = currentUser?.username || currentUser?.name || currentUser?.email || 'Admin';
  const roleBadge = currentUser?.role === 'admin' ? '👑 Admin' : '👤 Staff';

  const formattedTitle = `👥 [${group.name}] ${title}`;
  const fullMessage = `${message} — Created by: ${creatorName} (${roleBadge})`;
  
  // 1. Trigger push toast and audio alert
  triggerPushNotification(formattedTitle, fullMessage, 'info', actionTab);

  // 2. Dispatch real-time screen group event for any listening UI components
  window.dispatchEvent(new CustomEvent('screen-group-broadcast', {
    detail: {
      screenId,
      groupName: group.name,
      creatorName,
      userRole: currentUser?.role || 'staff',
      title,
      message: fullMessage,
      actionTab,
      timestamp: new Date().toISOString()
    }
  }));
};
