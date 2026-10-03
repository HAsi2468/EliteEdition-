import { triggerPushNotification } from '../components/NotificationToast';
import { api } from './api';
import { SCREEN_GROUPS, getDynamicScreenGroup } from '../config/screensConfig';

export { SCREEN_GROUPS };

export const getScreenGroupInfo = (screenId, allUsers = []) => {
  const group = getDynamicScreenGroup(screenId);

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
  const group = getDynamicScreenGroup(screenId);
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
