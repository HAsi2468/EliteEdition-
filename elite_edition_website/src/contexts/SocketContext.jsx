import React, { createContext, useContext, useEffect, useState } from 'react';
import { io } from 'socket.io-client';
import { getBaseUrl } from '../services/api';

const SocketContext = createContext(null);

export const useSocket = () => useContext(SocketContext);

// ── Helper: Fire a real OS-level browser notification ───────────────────────
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

// ── Helper: Fire an in-app toast via the global event bus ───────────────────
const fireInAppToast = (title, message, type = 'info') => {
  try {
    window.dispatchEvent(new CustomEvent('elite-push-notification', {
      detail: { title, message, type, timestamp: Date.now() }
    }));
  } catch (e) {}
};

export const SocketProvider = ({ children }) => {
  const [socket, setSocket] = useState(null);

  useEffect(() => {
    const apiUrl = getBaseUrl();
    let socketUrl = apiUrl.replace(/\/v1\/?$/, '');
    if (!socketUrl || !socketUrl.startsWith('http')) {
      socketUrl = typeof window !== 'undefined' ? window.location.origin : '';
    }

    const newSocket = io(socketUrl, {
      transports: ['websocket', 'polling'],
      autoConnect: true,
      reconnection: true,
      reconnectionAttempts: Infinity,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
      timeout: 20000,
    });

    newSocket.on('connect', () => {
      console.log('Socket connected:', newSocket.id);
      try {
        const rawUser = localStorage.getItem('elite_user');
        if (rawUser) {
          const u = JSON.parse(rawUser);
          const uId = u.id || u._id;
          if (uId) newSocket.emit('register-user', uId);
        }
      } catch (e) {}
    });

    newSocket.on('connect_error', () => {});

    newSocket.on('force-system-reload', () => {
      if ('caches' in window) {
        caches.keys().then(names => names.forEach(k => caches.delete(k)));
      }
      setTimeout(() => window.location.reload(true), 300);
    });

    // Designer Task Assignment Push Notification
    newSocket.on('designer-task-assigned', (data) => {
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
        const priorityEmoji =
          priority === 'Urgent' ? 'Red' :
          priority === 'High' ? 'Orange' :
          priority === 'Medium' ? 'Yellow' : 'Green';

        const notifTitle = `${action} - ${taskNo}`;
        const notifBody = `Design: ${designName}${fabric} | ${priority} Priority | By ${createdByName}`;

        fireBrowserNotification(notifTitle, notifBody, `elite-design-${taskNo}`);

        fireInAppToast(
          notifTitle,
          `${designName}${fabric} | ${priority} Priority`,
          isNew ? 'success' : 'info'
        );

        console.log('Designer task notification:', taskNo, designName);
      } catch (e) {
        console.warn('[SocketContext] designer-task-assigned error:', e.message);
      }
    });

    setSocket(newSocket);
    return () => newSocket.close();
  }, []);

  return (
    <SocketContext.Provider value={socket}>
      {children}
    </SocketContext.Provider>
  );
};
