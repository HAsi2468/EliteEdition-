import React, { createContext, useContext, useEffect, useState } from 'react';
import { io } from 'socket.io-client';
import { getBaseUrl } from '../services/api';

const SocketContext = createContext(null);

export const useSocket = () => useContext(SocketContext);

export const SocketProvider = ({ children }) => {
  const [socket, setSocket] = useState(null);

  useEffect(() => {
    // Get the base API URL and format it to target the socket server
    // (If API is http://3.7.174.180:3001/v1, socket server is on http://3.7.174.180:3001)
    const apiUrl = getBaseUrl();
    let socketUrl = apiUrl.replace(/\/v1\/?$/, '');
    if (!socketUrl || !socketUrl.startsWith('http')) {
      const hostname = window.location.hostname;
      const protocol = window.location.protocol;
      socketUrl = `${protocol}//${hostname}:5000`;
    }

    const newSocket = io(socketUrl, {
      transports: ['polling', 'websocket'],
      autoConnect: true,
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
