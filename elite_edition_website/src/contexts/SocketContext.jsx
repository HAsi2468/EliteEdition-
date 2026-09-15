import React, { createContext, useContext, useEffect, useState } from 'react';
import { io } from 'socket.io-client';
import { getBaseUrl } from '../services/api';

const SocketContext = createContext(null);

export const useSocket = () => useContext(SocketContext);

export const SocketProvider = ({ children }) => {
  const [socket, setSocket] = useState(null);

  useEffect(() => {
    // Determine socket server URL relative to HTTPS origin or API base
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
      timeout: 20000
    });

    newSocket.on('connect', () => {
      console.log('⚡ Socket connected successfully:', newSocket.id);
      try {
        const rawUser = localStorage.getItem('elite_user');
        if (rawUser) {
          const u = JSON.parse(rawUser);
          const uId = u.id || u._id;
          if (uId) {
            newSocket.emit('register-user', uId);
          }
        }
      } catch (e) {}
    });

    newSocket.on('connect_error', () => {
      // Suppress noisy logs during network switching
    });

    newSocket.on('force-system-reload', (data) => {
      console.log('⚡ Force system reload signal received:', data);
      if ('caches' in window) {
        caches.keys().then((names) => {
          for (let name of names) caches.delete(name);
        });
      }
      setTimeout(() => {
        window.location.reload(true);
      }, 300);
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

