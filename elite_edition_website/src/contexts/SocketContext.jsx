import React, { createContext, useContext, useEffect, useState } from 'react';
import { socketManager } from '../services/socketManager';

const SocketContext = createContext(null);

export const useSocket = () => useContext(SocketContext);

// ── Helper: Fire an OS-level browser notification ───────────────────────
const fireBrowserNotification = async (title, body, tag = 'elite-task') => {
  try {
    if (!('Notification' in window)) return;
    if (Notification.permission === 'default') {
      await Notification.requestPermission();
    }
    if (Notification.permission === 'granted') {
      const n = new Notification(title, {
        body,
        tag,
        icon: '/pwa-192x192.png',
        badge: '/pwa-192x192.png',
        requireInteraction: true,
        vibrate: [200, 100, 200],
      });
      n.onclick = () => { window.focus(); n.close(); };
    }
  } catch (e) {
    console.warn('[SocketContext] Browser notification failed:', e.message);
  }
};

// ── Helper: Fire an in-app toast via global event bus ───────────────────
const fireInAppToast = (title, message, type = 'info') => {
  try {
    window.dispatchEvent(new CustomEvent('elite-push-notification', {
      detail: { title, message, type, timestamp: Date.now() }
    }));
  } catch (e) {}
};

export const SocketProvider = ({ children }) => {
  const getInitialSocket = () => {
    if (typeof window === 'undefined') return null;
    let companyId = 'digital_print';
    let userId = null;
    try {
      const storedDept = localStorage.getItem('elite_active_department');
      if (storedDept) companyId = storedDept;
      const rawUser = localStorage.getItem('elite_user');
      if (rawUser) {
        const u = JSON.parse(rawUser);
        userId = u.id || u._id || null;
      }
    } catch (e) {}
    return socketManager.init(companyId, null, userId);
  };

  const [socket, setSocket] = useState(() => getInitialSocket());
  const [connectionStatus, setConnectionStatus] = useState(() => socketManager.getStatus()); // 'connected' | 'reconnecting' | 'offline' | 'disconnected'

  useEffect(() => {
    // Read stored user and department
    let companyId = 'digital_print';
    let userId = null;
    try {
      const storedDept = localStorage.getItem('elite_active_department');
      if (storedDept) companyId = storedDept;
      const rawUser = localStorage.getItem('elite_user');
      if (rawUser) {
        const u = JSON.parse(rawUser);
        userId = u.id || u._id || null;
      }
    } catch (e) {}

    // Initialize central socket manager
    const newSocket = socketManager.init(companyId, null, userId);
    setSocket(newSocket);

    // Track status
    const unsubStatus = socketManager.onStatusChange((status) => {
      setConnectionStatus(status);
    });

    // Designer Task Assignment Push Notification
    const handleDesignerTask = (data) => {
      try {
        const {
          taskNo = '',
          designName = 'New Design',
          fabricName = '',
          priority = 'Medium',
          isNew = true,
          createdByName = 'Admin',
        } = data || {};

        const action = isNew ? 'New Design Assigned' : 'Design Task Updated';
        const fabric = fabricName ? ` - Fabric: ${fabricName}` : '';
        const notifTitle = `${action} - ${taskNo}`;
        const notifBody = `Design: ${designName}${fabric} | ${priority} Priority | By ${createdByName}`;

        fireBrowserNotification(notifTitle, notifBody, `elite-design-${taskNo}`);
        fireInAppToast(notifTitle, `${designName}${fabric} | ${priority} Priority`, isNew ? 'success' : 'info');
      } catch (e) {
        console.warn('[SocketContext] designer-task-assigned error:', e.message);
      }
    };

    // General Task Assignment Push Notification
    const handleTaskAssigned = (data) => {
      try {
        const {
          title = 'New Task',
          priority = 'medium',
          department = 'General',
          dueDate = null,
          createdByName = 'Admin',
          taskId = '',
        } = data || {};

        const notifTitle = `📋 New Task Assigned: ${title}`;
        const dueStr = dueDate ? ` | Due: ${new Date(dueDate).toLocaleDateString()}` : '';
        const notifBody = `Assigned by ${createdByName} • Priority: ${priority.toUpperCase()} • Dept: ${department}${dueStr}`;

        fireBrowserNotification(notifTitle, notifBody, `elite-task-${taskId || Date.now()}`);
        fireInAppToast(notifTitle, notifBody, 'info');
      } catch (e) {
        console.warn('[SocketContext] task-assigned error:', e.message);
      }
    };

    if (newSocket && typeof newSocket.on === 'function') {
      newSocket.on('designer-task-assigned', handleDesignerTask);
      newSocket.on('task-assigned', handleTaskAssigned);
    }

    return () => {
      if (newSocket && typeof newSocket.off === 'function') {
        newSocket.off('designer-task-assigned', handleDesignerTask);
        newSocket.off('task-assigned', handleTaskAssigned);
      }
      unsubStatus();
    };
  }, []);

  // Backwards compatible: context value allows both direct socket access and helper properties
  // When accessed as socket directly (e.g. `const socket = useSocket()`), proxy returns socket methods.
  const contextValue = {
    socket: socket || socketManager.socket,
    connectionStatus,
    isConnected: connectionStatus === 'connected',
    isOffline: connectionStatus === 'offline' || connectionStatus === 'reconnecting',
    resync: () => socketManager.resync('user-trigger'),
    setCompany: (id, code) => socketManager.setCompany(id, code)
  };

  // Safe fallback delegator for socket methods
  const safeDelegate = {
    emit: (...args) => {
      const active = socket || socketManager.socket;
      if (active && typeof active.emit === 'function') {
        return active.emit(...args);
      }
    },
    on: (...args) => {
      const active = socket || socketManager.socket;
      if (active && typeof active.on === 'function') {
        return active.on(...args);
      }
    },
    off: (...args) => {
      const active = socket || socketManager.socket;
      if (active && typeof active.off === 'function') {
        return active.off(...args);
      }
    }
  };

  // Allow `useSocket()` to be used both as `socket` (with `.on()`, `.emit()`, `.off()`) and as object `{ socket, connectionStatus }`
  const activeTarget = socket || socketManager.socket || safeDelegate;
  const proxyValue = new Proxy(activeTarget, {
    get(targetObj, prop) {
      if (prop in contextValue) {
        return contextValue[prop];
      }
      if (prop in targetObj) {
        const val = targetObj[prop];
        return typeof val === 'function' ? val.bind(targetObj) : val;
      }
      if (prop in safeDelegate) {
        return safeDelegate[prop];
      }
      return undefined;
    }
  });

  return (
    <SocketContext.Provider value={proxyValue}>
      {children}
    </SocketContext.Provider>
  );
};

export default SocketContext;
