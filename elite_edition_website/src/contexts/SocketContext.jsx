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
    const socketUrl = apiUrl.replace(/\/v1\/?$/, '');

    const newSocket = io(socketUrl, {
      transports: ['websocket'],
      autoConnect: true,
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
