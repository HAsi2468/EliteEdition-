import React, { useEffect, useState, useRef } from 'react';
import { useSocket } from '../contexts/SocketContext';
import { api } from '../services/api';
import { MessageSquare, Send, Users, Hash, Plus, CheckSquare, X, ImagePlus, Loader2, Paperclip, Mic, Pin, Trash2, Edit2, Settings, Volume2 } from 'lucide-react';
import imageCompression from 'browser-image-compression';

const Workspace = ({ currentUser }) => {
  const socket = useSocket();
  const [connected, setConnected] = useState(false);
  
  const [rooms, setRooms] = useState([]);
  const [activeRoom, setActiveRoom] = useState(null);
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState('');
  
   // Phase 4 States
  const [hoveredMessageId, setHoveredMessageId] = useState(null);
  const [taskModalMsg, setTaskModalMsg] = useState(null);
  const [taskTitle, setTaskTitle] = useState('');
  const [taskPriority, setTaskPriority] = useState('medium');
  const [taskAssignee, setTaskAssignee] = useState(''); // Stores a user _id
  const [taskDueDate, setTaskDueDate] = useState('');
  const [allUsers, setAllUsers] = useState([]); // Fetched from backend

  // Enhancements States
  const [draggedTaskId, setDraggedTaskId] = useState(null);
  const [editTask, setEditTask] = useState(null); // Stores task data for details/editing modal
  const [showCreateRoomModal, setShowCreateRoomModal] = useState(false);
  const [newRoomName, setNewRoomName] = useState('');
  const [newRoomMembers, setNewRoomMembers] = useState([]); // Array of user IDs to add to new group room
  
  // Advanced Features States
  const [searchQuery, setSearchQuery] = useState('');
  const [replyToMessage, setReplyToMessage] = useState(null);
  const [typingUsers, setTypingUsers] = useState({});
  const [taskSearchQuery, setTaskSearchQuery] = useState('');
  const typingTimeoutRef = useRef(null);
  const isTypingRef = useRef(false);
  const [newChecklistItem, setNewChecklistItem] = useState('');
  const [newCommentText, setNewCommentText] = useState('');

  // Enterprise Enhancements States
  const [onlineUsers, setOnlineUsers] = useState([]);
  const [unreadCounts, setUnreadCounts] = useState({});
  const [mentionSearch, setMentionSearch] = useState('');
  const [showMentionDropdown, setShowMentionDropdown] = useState(false);
  const [mentionCursorIndex, setMentionCursorIndex] = useState(-1);
  const [hasMoreMessages, setHasMoreMessages] = useState(true);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [isDragging, setIsDragging] = useState(false);

  // Advanced Voice, Edit, Pin, Settings States
  const [isRecording, setIsRecording] = useState(false);
  const [mediaRecorder, setMediaRecorder] = useState(null);
  const [audioChunks, setAudioChunks] = useState([]);
  const [editingMessageId, setEditingMessageId] = useState(null);
  const [showPinsDrawer, setShowPinsDrawer] = useState(false);
  const [showSettingsModal, setShowSettingsModal] = useState(false);
  const [settingsRoomName, setSettingsRoomName] = useState('');
  const [settingsRoomMembers, setSettingsRoomMembers] = useState([]);
  const [settingsRoomArchived, setSettingsRoomArchived] = useState(false);

  // Gantt, Audit, Timer, Tags Task Board states
  const [activeTimerTaskId, setActiveTimerTaskId] = useState(null);
  const [timerSeconds, setTimerSeconds] = useState(0);
  const [taskDetailTab, setTaskDetailTab] = useState('details');
  const [newTagText, setNewTagText] = useState('');
  const [newTagColor, setNewTagColor] = useState('#3b82f6');
  const [newSubTaskTitle, setNewSubTaskTitle] = useState('');
  const [newSubTaskAssignee, setNewSubTaskAssignee] = useState('');
  const [manualLogHours, setManualLogHours] = useState('');
  const [manualLogDesc, setManualLogDesc] = useState('');
  const [workspaceTaskTab, setWorkspaceTaskTab] = useState('board');
  const [selectedFilterTags, setSelectedFilterTags] = useState([]);

  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef(null);
  
  const messagesEndRef = useRef(null);

  const [toasts, setToasts] = useState([]);
  const [lastReadTimes, setLastReadTimes] = useState(() => {
    return JSON.parse(localStorage.getItem('elite_chat_last_read') || '{}');
  });

  const showToast = (title, body, onClickAction) => {
    const id = Date.now() + Math.random().toString(36).substr(2, 9);
    setToasts(prev => [...prev, { id, title, body, onClick: onClickAction }]);
    setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== id));
    }, 4000);
  };

  const markRoomAsRead = (roomId) => {
    const updated = {
      ...lastReadTimes,
      [roomId]: new Date().toISOString()
    };
    setLastReadTimes(updated);
    localStorage.setItem('elite_chat_last_read', JSON.stringify(updated));
  };

  // Initial unread counts setup
  useEffect(() => {
    if (rooms.length > 0) {
      const initial = {};
      rooms.forEach(r => {
        const lastRead = lastReadTimes[r._id];
        const hasNew = !lastRead || new Date(r.updatedAt || r.createdAt) > new Date(lastRead);
        if (hasNew && (!activeRoom || activeRoom._id !== r._id)) {
          initial[r._id] = 1;
        }
      });
      setUnreadCounts(prev => ({ ...initial, ...prev }));
    }
  }, [rooms]);

  // Mark room as read when activeRoom changes
  useEffect(() => {
    if (activeRoom) {
      markRoomAsRead(activeRoom._id);
      setUnreadCounts(prev => ({
        ...prev,
        [activeRoom._id]: 0
      }));
      setHasMoreMessages(true);
      if (socket) {
        socket.emit('read-room-messages', { roomId: activeRoom._id, userId: currentUser._id });
      }
    }
  }, [activeRoom, socket]);

  // Emit read receipt when new messages are appended to active room
  useEffect(() => {
    if (activeRoom && socket && messages.length > 0) {
      socket.emit('read-room-messages', { roomId: activeRoom._id, userId: currentUser._id });
    }
  }, [activeRoom, socket, messages.length]);

  const [workspaceTab, setWorkspaceTab] = useState('chat'); // 'chat' or 'tasks'
  const [boardTasks, setBoardTasks] = useState([]);

  const [taskFilter, setTaskFilter] = useState('my-tasks'); // 'my-tasks' or 'all-tasks'

  // Fetch Tasks for Kanban
  const fetchBoardTasks = async () => {
    try {
      const res = await api.getTasks();
      if (res.data) setBoardTasks(res.data);
    } catch (error) {
      console.error('Failed to fetch board tasks', error);
    }
  };

  useEffect(() => {
    if (workspaceTab === 'tasks') {
      fetchBoardTasks();
    }
  }, [workspaceTab]);

  useEffect(() => {
    if (!socket) return;
    const onConnect = () => setConnected(true);
    const onDisconnect = () => setConnected(false);
    socket.on('connect', onConnect);
    socket.on('disconnect', onDisconnect);
    if (socket.connected) setConnected(true);
    
    return () => {
      socket.off('connect', onConnect);
      socket.off('disconnect', onDisconnect);
    };
  }, [socket]);

  // Fetch Rooms & Users
  useEffect(() => {
    fetchRooms();
    fetchUsers();
  }, []);

  // Join all member rooms to listen for background messages & notifications
  const joinedRoomsRef = useRef(new Set());
  useEffect(() => {
    if (!socket || rooms.length === 0) return;
    rooms.forEach(room => {
      if (!joinedRoomsRef.current.has(room._id)) {
        socket.emit('join-room', room._id);
        joinedRoomsRef.current.add(room._id);
      }
    });
  }, [socket, rooms]);

  const fetchRooms = async () => {
    try {
      const res = await api.getRooms(currentUser._id);
      if (res.data && res.data.length > 0) {
        setRooms(res.data);
        setActiveRoom(res.data[0]);
      } else {
        const defaultRoom = await api.createRoom({ name: 'General', type: 'group' });
        if (defaultRoom.data) {
          setRooms([defaultRoom.data]);
          setActiveRoom(defaultRoom.data);
        }
      }
    } catch (error) {
      console.error('Failed to fetch rooms', error);
    }
  };

  const fetchUsers = async () => {
    try {
      const res = await api.getUsers({ limit: 100 });
      if (res && res.users && res.users.rows) {
        setAllUsers(res.users.rows);
      } else if (res && res.data) {
        setAllUsers(res.data);
      }
    } catch (error) {
      console.error('Failed to fetch users', error);
    }
  };

  const handleUserDMClick = async (user) => {
    // Check if we already have a direct room with them
    const existingRoom = rooms.find(r => 
      r.type === 'direct' && 
      r.members?.some(m => (m._id || m) === user._id)
    );

    if (existingRoom) {
      setActiveRoom(existingRoom);
    } else {
      // Create new DM room
      try {
        const res = await api.createRoom({
          name: `DM_${currentUser.name || currentUser.username}_${user.name || user.username}`,
          type: 'direct',
          members: [currentUser._id, user._id]
        });
        if (res.data) {
          setRooms(prev => [...prev, res.data]);
          setActiveRoom(res.data);
        }
      } catch (error) {
        console.error('Failed to create DM room', error);
      }
    }
  };

  // Join Room & Fetch Messages
  useEffect(() => {
    if (!socket || !activeRoom) return;
    socket.emit('join-room', activeRoom._id);

    // Reset typing status on channel switch
    setTypingUsers({});

    const loadMessages = async () => {
      try {
        const res = await api.getRoomMessages(activeRoom._id);
        if (res.data) setMessages(res.data);
        scrollToBottom();
      } catch (error) {
        console.error('Failed to fetch messages', error);
      }
    };
    loadMessages();

    const handleReceiveMessage = (message) => {
      if (message.roomId === activeRoom._id || message.roomId?._id === activeRoom._id) {
        setMessages((prev) => [...prev, message]);
        scrollToBottom();
      }
    };

    const handleUserTyping = ({ roomId, username, isTyping }) => {
      if (roomId === activeRoom._id) {
        setTypingUsers(prev => {
          const copy = { ...prev };
          if (isTyping) {
            copy[username] = true;
          } else {
            delete copy[username];
          }
          return copy;
        });
      }
    };

    const handleReactionUpdated = ({ messageId, reactions }) => {
      setMessages((prev) => prev.map(msg => {
        if (msg._id === messageId) {
          return { ...msg, reactions };
        }
        return msg;
      }));
    };

    const handleTaskUpdated = (updatedTask) => {
      // Update in chat if visible
      setMessages((prev) => prev.map(msg => {
        if (msg.taskId && msg.taskId._id === updatedTask._id) {
          return { ...msg, taskId: updatedTask };
        }
        return msg;
      }));
      // Update in board if visible
      setBoardTasks((prev) => {
        const exists = prev.find(t => t._id === updatedTask._id);
        if (exists) {
          return prev.map(t => t._id === updatedTask._id ? updatedTask : t);
        } else {
          return [updatedTask, ...prev]; // Add new tasks created from other clients
        }
      });
    };

    const handleTaskDeleted = (taskId) => {
      // Remove from Board
      setBoardTasks((prev) => prev.filter(t => t._id !== taskId));
      // Remove from Chat Timeline
      setMessages((prev) => prev.filter(msg => !msg.taskId || (msg.taskId._id !== taskId && msg.taskId !== taskId)));
    };

    const handleRoomMessagesRead = ({ roomId, userId }) => {
      if (activeRoom && activeRoom._id === roomId) {
        setMessages((prev) => prev.map(msg => {
          const isSender = String(msg.senderId?._id || msg.senderId) === String(userId);
          const hasRead = msg.readBy?.includes(userId);
          if (!isSender && !hasRead) {
            return {
              ...msg,
              readBy: [...(msg.readBy || []), userId]
            };
          }
          return msg;
        }));
      }
    };
    const handleMessageEdited = ({ messageId, newContent }) => {
      setMessages(prev => prev.map(msg => 
        msg._id === messageId ? { ...msg, content: newContent, isEdited: true } : msg
      ));
    };

    const handleMessageDeleted = ({ messageId }) => {
      setMessages(prev => prev.map(msg => 
        msg._id === messageId ? { ...msg, content: 'This message was deleted', isDeleted: true, attachment: null } : msg
      ));
    };

    const handleMessagePinUpdated = ({ messageId, isPinned }) => {
      setMessages(prev => prev.map(msg => 
        msg._id === messageId ? { ...msg, isPinned } : msg
      ));
    };

    const handleRoomSettingsUpdated = (updatedRoom) => {
      if (activeRoom && activeRoom._id === updatedRoom._id) {
        setActiveRoom(updatedRoom);
      }
      setRooms(prev => prev.map(r => r._id === updatedRoom._id ? updatedRoom : r));
    };

    socket.on('receive-message', handleReceiveMessage);
    socket.on('task-updated', handleTaskUpdated);
    socket.on('task-deleted', handleTaskDeleted);
    socket.on('user-typing', handleUserTyping);
    socket.on('message-reaction-updated', handleReactionUpdated);
    socket.on('room-messages-read', handleRoomMessagesRead);
    socket.on('message-edited', handleMessageEdited);
    socket.on('message-deleted', handleMessageDeleted);
    socket.on('message-pin-updated', handleMessagePinUpdated);
    socket.on('room-settings-updated', handleRoomSettingsUpdated);

    return () => {
      socket.off('receive-message', handleReceiveMessage);
      socket.off('task-updated', handleTaskUpdated);
      socket.off('task-deleted', handleTaskDeleted);
      socket.off('user-typing', handleUserTyping);
      socket.off('message-reaction-updated', handleReactionUpdated);
      socket.off('room-messages-read', handleRoomMessagesRead);
      socket.off('message-edited', handleMessageEdited);
      socket.off('message-deleted', handleMessageDeleted);
      socket.off('message-pin-updated', handleMessagePinUpdated);
      socket.off('room-settings-updated', handleRoomSettingsUpdated);
    };
  }, [socket, activeRoom]);

  // Mutable refs to keep notifications socket callbacks registered exactly once without stale closures
  const activeRoomRef = useRef(activeRoom);
  const roomsRef = useRef(rooms);

  useEffect(() => {
    activeRoomRef.current = activeRoom;
  }, [activeRoom]);

  useEffect(() => {
    roomsRef.current = rooms;
  }, [rooms]);

  const playNotificationSound = () => {
    try {
      const ctx = new (window.AudioContext || window.webkitAudioContext)();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      
      osc.type = 'sine';
      osc.frequency.setValueAtTime(523.25, ctx.currentTime);
      osc.frequency.setValueAtTime(659.25, ctx.currentTime + 0.1);
      
      gain.gain.setValueAtTime(0.1, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.3);
      
      osc.connect(gain);
      gain.connect(ctx.destination);
      
      osc.start();
      osc.stop(ctx.currentTime + 0.3);
    } catch (err) {
      console.warn('Audio notification failed:', err);
    }
  };

  // Notifications Effect for Messages & Tasks
  useEffect(() => {
    if (!socket || !currentUser) return;

    if ('Notification' in window && Notification.permission === 'default') {
      Notification.requestPermission();
    }

    // Register user to personal channel for direct messaging notifications
    const userId = currentUser._id || currentUser.id;
    socket.emit('register-user', userId);

    const handleReceiveMessageNotify = (message) => {
      const isMine = message.senderId?._id === currentUser._id;
      const currentActiveRoom = activeRoomRef.current;
      const currentRooms = roomsRef.current;
      const isActive = currentActiveRoom && (message.roomId === currentActiveRoom._id || message.roomId?._id === currentActiveRoom._id);
      
      // Update room updatedAt in state list to trigger unread badge update dynamically
      setRooms(prevRooms => {
        return prevRooms.map(r => {
          const match = r._id === message.roomId || r._id === message.roomId?._id;
          if (match) {
            return { ...r, updatedAt: message.createdAt || new Date().toISOString() };
          }
          return r;
        });
      });

      // Increment unread counters if not active
      if (!isMine && !isActive) {
        const targetRoomId = message.roomId?._id || message.roomId;
        setUnreadCounts(prev => ({
          ...prev,
          [targetRoomId]: (prev[targetRoomId] || 0) + 1
        }));
      }

      if (!isMine && (!isActive || document.hidden)) {
        const senderName = message.senderId?.name || message.senderId?.username || 'Someone';
        let title = `New message in #${message.roomId?.name || 'chat'}`;
        
        // Find if room name is known
        const targetRoom = currentRooms.find(r => r._id === message.roomId || r._id === message.roomId?._id);
        if (targetRoom) {
          if (targetRoom.type === 'direct') {
            title = `New message from ${senderName}`;
          } else {
            title = `New message in #${targetRoom.name}`;
          }
        } else if (message.roomId?.type === 'direct' || message.roomId?.name) {
          title = message.roomId.type === 'direct' ? `New message from ${senderName}` : `New message in #${message.roomId.name}`;
        }
        
        // 1. Show HTML5 browser notification
        if ('Notification' in window && Notification.permission === 'granted') {
          new Notification(title, {
            body: message.content,
            icon: '/vite.svg'
          });
        }
        
        // 2. Show in-app Toast Notification
        showToast(title, message.content, () => {
          const matchedRoom = roomsRef.current.find(r => r._id === message.roomId || r._id === message.roomId?._id);
          if (matchedRoom) {
            setActiveRoom(matchedRoom);
            setWorkspaceTab('chat');
          }
        });
      }
    };

    const handleTaskUpdatedNotify = (task) => {
      const isAssignedToMe = task.assignees?.some(a => a._id === currentUser._id);
      
      if (isAssignedToMe) {
        // 1. Browser Notification
        if ('Notification' in window && Notification.permission === 'granted') {
          new Notification(`Task Assignment: ${task.title}`, {
            body: `Status: ${task.status} · Priority: ${task.priority}`,
            icon: '/vite.svg'
          });
        }
        
        // 2. In-App Toast
        showToast(`Task Updated: ${task.title}`, `Status: ${task.status} · Priority: ${task.priority}`, () => {
          setWorkspaceTab('tasks');
        });
      }
    };

    const handleRoomCreated = (newRoom) => {
      const isMember = newRoom.members?.some(m => (m._id || m) === userId);
      const exists = roomsRef.current.some(r => r._id === newRoom._id);
      
      if (isMember && !exists) {
        setRooms(prev => [...prev, newRoom]);
        // Instantly join the new room socket channel!
        socket.emit('join-room', newRoom._id);
        console.log('Registered and joined new live room:', newRoom._id);
      }
    };

    const handlePresenceSync = (userIds) => {
      setOnlineUsers(userIds);
    };

    const handleMentionNotification = ({ roomId, senderName, content }) => {
      playNotificationSound();
      showToast(`Mentioned by ${senderName}`, content, () => {
        const matchedRoom = roomsRef.current.find(r => r._id === roomId || r._id === roomId?._id);
        if (matchedRoom) {
          setActiveRoom(matchedRoom);
          setWorkspaceTab('chat');
        }
      });
    };

    const handleGlobalRoomUpdated = (updatedRoom) => {
      if (updatedRoom.isArchived) {
        setRooms(prev => prev.filter(r => r._id !== updatedRoom._id));
        if (activeRoomRef.current && activeRoomRef.current._id === updatedRoom._id) {
          setActiveRoom(null);
        }
      } else {
        const isMember = updatedRoom.members?.some(m => (m._id || m) === userId);
        if (isMember) {
          setRooms(prev => {
            const exists = prev.some(r => r._id === updatedRoom._id);
            if (exists) {
              return prev.map(r => r._id === updatedRoom._id ? updatedRoom : r);
            }
            return [...prev, updatedRoom];
          });
        }
      }
    };

    socket.on('receive-message', handleReceiveMessageNotify);
    socket.on('task-updated', handleTaskUpdatedNotify);
    socket.on('room-created', handleRoomCreated);
    socket.on('presence-sync', handlePresenceSync);
    socket.on('mention-notification', handleMentionNotification);
    socket.on('global-room-updated', handleGlobalRoomUpdated);

    return () => {
      socket.off('receive-message', handleReceiveMessageNotify);
      socket.off('task-updated', handleTaskUpdatedNotify);
      socket.off('room-created', handleRoomCreated);
      socket.off('presence-sync', handlePresenceSync);
      socket.off('mention-notification', handleMentionNotification);
      socket.off('global-room-updated', handleGlobalRoomUpdated);
    };
  }, [socket, currentUser]);

  const timerIntervalRef = useRef(null);

  useEffect(() => {
    if (activeTimerTaskId) {
      timerIntervalRef.current = setInterval(() => {
        setTimerSeconds(prev => prev + 1);
      }, 1000);
    } else {
      if (timerIntervalRef.current) {
        clearInterval(timerIntervalRef.current);
      }
    }
    return () => {
      if (timerIntervalRef.current) {
        clearInterval(timerIntervalRef.current);
      }
    };
  }, [activeTimerTaskId]);

  const scrollToBottom = () => {
    setTimeout(() => {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, 100);
  };

  const renderReadReceipt = (msg) => {
    const isMine = msg.senderId?._id === currentUser._id;
    if (!isMine) return null;
    
    const readers = (msg.readBy || []).filter(id => String(id._id || id) !== String(currentUser._id));
    const isRead = readers.length > 0;
    
    return (
      <span style={{ fontSize: '0.75rem', marginLeft: '6px', color: isRead ? '#38bdf8' : 'var(--text-muted, #8892a4)', display: 'inline-flex', alignItems: 'center' }} title={isRead ? `Read` : 'Sent'}>
        {isRead ? '✓✓' : '✓'}
      </span>
    );
  };

  const renderAttachment = (att) => {
    if (!att || !att.fileUrl) return null;
    
    const isAudio = att.fileType?.startsWith('audio/') || att.fileName?.match(/\.(webm|ogg|wav|mp3|m4a)$/i);
    if (isAudio) {
      return (
        <div style={{
          display: 'flex',
          flexDirection: 'column',
          gap: '6px',
          padding: '10px 14px',
          borderRadius: '8px',
          backgroundColor: 'rgba(0,0,0,0.15)',
          border: '1px solid rgba(255,255,255,0.08)',
          maxWidth: '300px',
          marginTop: '6px'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
            <Volume2 size={16} color="var(--primary)" />
            <span>Voice Memo</span>
          </div>
          <audio controls src={att.fileUrl} style={{ width: '100%', height: '32px', outline: 'none' }} />
        </div>
      );
    }

    const isImage = att.fileType?.startsWith('image/') || att.fileUrl?.match(/\.(jpg|jpeg|png|gif)$/i);
    if (isImage) {
      return <img src={att.fileUrl} alt={att.fileName} style={{ maxWidth: '100%', borderRadius: '8px', maxHeight: '300px', objectFit: 'contain', marginTop: '6px' }} />;
    }
    
    const isPdf = att.fileType === 'application/pdf' || att.fileName?.endsWith('.pdf');
    const isExcel = att.fileType?.includes('sheet') || att.fileType?.includes('excel') || att.fileName?.endsWith('.xlsx') || att.fileName?.endsWith('.xls');
    
    let icon = '📄';
    let color = '#38bdf8';
    if (isPdf) {
      icon = '📕';
      color = '#ef4444';
    } else if (isExcel) {
      icon = '📗';
      color = '#10b981';
    }
    
    const sizeStr = att.fileSize ? ` (${(att.fileSize / 1024).toFixed(1)} KB)` : '';
    
    return (
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: '12px',
        padding: '12px',
        borderRadius: '8px',
        backgroundColor: 'rgba(0,0,0,0.15)',
        border: '1px solid rgba(255,255,255,0.08)',
        maxWidth: '320px',
        marginTop: '6px'
      }}>
        <span style={{ fontSize: '2rem' }}>{icon}</span>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '2px', flex: 1, minWidth: 0 }}>
          <span style={{ fontSize: '0.85rem', fontWeight: 'bold', color: 'var(--text-primary)', textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap' }} title={att.fileName}>
            {att.fileName}
          </span>
          <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
            {sizeStr || 'Document'}
          </span>
          <a 
            href={att.fileUrl} 
            download={att.fileName}
            target="_blank"
            rel="noopener noreferrer"
            style={{ fontSize: '0.8rem', color: color, textDecoration: 'underline', marginTop: '4px', fontWeight: 'bold' }}
          >
            Download Attachment
          </a>
        </div>
      </div>
    );
  };

  const insertMention = (user) => {
    const username = user.username || user.name.replace(/\s+/g, '');
    const before = newMessage.substring(0, mentionCursorIndex);
    // Calculate exact slice after cursor. Since we typed @query, query length is mentionSearch.length
    const after = newMessage.substring(mentionCursorIndex + mentionSearch.length + 1);
    const newVal = `${before}@${username} ${after}`;
    setNewMessage(newVal);
    setShowMentionDropdown(false);
    setTimeout(() => {
      document.getElementById('chat-input-field')?.focus();
    }, 20);
  };

  const handleDragOver = (e) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = async (e) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (file && activeRoom) {
      await uploadAndSendFile(file);
    }
  };

  const handleScroll = async (e) => {
    const el = e.target;
    if (el.scrollTop === 0 && hasMoreMessages && !isLoadingMore && messages.length > 0) {
      setIsLoadingMore(true);
      const oldestMsgId = messages[0]._id;
      try {
        const res = await api.getRoomMessages(activeRoom._id, oldestMsgId);
        if (res.data) {
          if (res.data.length < 50) {
            setHasMoreMessages(false);
          }
          const prevHeight = el.scrollHeight;
          setMessages(prev => [...res.data, ...prev]);
          
          setTimeout(() => {
            el.scrollTop = el.scrollHeight - prevHeight;
          }, 50);
        }
      } catch (error) {
        console.error('Failed to load older messages', error);
      } finally {
        setIsLoadingMore(false);
      }
    }
  };
  const renderKanbanDashboard = () => {
    const tasksToAnalyze = boardTasks.filter(task => {
      const matchesSearch = taskSearchQuery.trim() ? task.title?.toLowerCase().includes(taskSearchQuery.toLowerCase()) : true;
      if (taskFilter === 'my-tasks') {
        const isMine = task.assignees?.some(a => a._id === currentUser._id);
        return isMine && matchesSearch;
      }
      return matchesSearch;
    });

    const todoCount = tasksToAnalyze.filter(t => t.status === 'To Do').length;
    const progressCount = tasksToAnalyze.filter(t => t.status === 'In Progress').length;
    const doneCount = tasksToAnalyze.filter(t => t.status === 'Done').length;
    const total = todoCount + progressCount + doneCount;
    const completedPct = total > 0 ? Math.round((doneCount / total) * 100) : 0;
    
    const highPriorityCount = tasksToAnalyze.filter(t => t.priority === 'high').length;
    const mediumPriorityCount = tasksToAnalyze.filter(t => t.priority === 'medium').length;
    const lowPriorityCount = tasksToAnalyze.filter(t => t.priority === 'low').length;
    
    return (
      <div style={{
        display: 'flex',
        gap: '20px',
        marginBottom: '20px',
        flexWrap: 'wrap',
      }}>
        <div className="glass-panel" style={{ flex: 1, minWidth: '240px', padding: '16px', borderRadius: '12px', border: '1px solid var(--border-light)', backgroundColor: 'var(--bg-card, #161b26)', display: 'flex', alignItems: 'center', gap: '15px' }}>
          <div style={{
            position: 'relative',
            width: '60px',
            height: '60px',
            borderRadius: '50%',
            background: `conic-gradient(var(--primary, #3b82f6) ${completedPct}%, rgba(255,255,255,0.05) ${completedPct}% 100%)`,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center'
          }}>
            <div style={{
              width: '46px',
              height: '46px',
              borderRadius: '50%',
              backgroundColor: '#161b26',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '0.85rem',
              fontWeight: 'bold',
              color: 'var(--primary, #3b82f6)'
            }}>
              {completedPct}%
            </div>
          </div>
          <div>
            <h4 style={{ margin: 0, fontSize: '0.9rem', color: 'var(--text-secondary)' }}>Completion Rate</h4>
            <span style={{ fontSize: '1.2rem', fontWeight: 'bold', color: 'var(--text-primary)' }}>
              {doneCount} / {total} Completed
            </span>
          </div>
        </div>
        
        <div className="glass-panel" style={{ flex: 1, minWidth: '240px', padding: '16px', borderRadius: '12px', border: '1px solid var(--border-light)', backgroundColor: 'var(--bg-card, #161b26)', display: 'flex', flexDirection: 'column', gap: '8px', justifyContent: 'center' }}>
          <h4 style={{ margin: 0, fontSize: '0.9rem', color: 'var(--text-secondary)' }}>Priority Breakdown</h4>
          <div style={{ display: 'flex', gap: '12px', fontSize: '0.85rem' }}>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', color: '#ef4444', fontWeight: 'bold' }}>
              🔴 High: {highPriorityCount}
            </span>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', color: '#f59e0b', fontWeight: 'bold' }}>
              🟡 Med: {mediumPriorityCount}
            </span>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', color: '#10b981', fontWeight: 'bold' }}>
              🟢 Low: {lowPriorityCount}
            </span>
          </div>
        </div>
        
        <div className="glass-panel" style={{ flex: 1, minWidth: '240px', padding: '16px', borderRadius: '12px', border: '1px solid var(--border-light)', backgroundColor: 'var(--bg-card, #161b26)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
            <h4 style={{ margin: 0, fontSize: '0.9rem', color: 'var(--text-secondary)' }}>Pending Tasks</h4>
            <span style={{ fontSize: '1.4rem', fontWeight: 'bold', color: '#f59e0b' }}>
              {todoCount + progressCount}
            </span>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '2px', alignItems: 'flex-end' }}>
            <h4 style={{ margin: 0, fontSize: '0.9rem', color: 'var(--text-secondary)' }}>Total Tasks</h4>
            <span style={{ fontSize: '1.4rem', fontWeight: 'bold', color: 'var(--text-primary)' }}>
              {total}
            </span>
          </div>
        </div>
      </div>
    );
  };
  const handleInputChange = (e) => {
    const val = e.target.value;
    setNewMessage(val);
    
    // Mentions detection
    const cursor = e.target.selectionStart || 0;
    const textBeforeCursor = val.substring(0, cursor);
    const lastAt = textBeforeCursor.lastIndexOf('@');
    
    if (lastAt !== -1 && !textBeforeCursor.substring(lastAt).includes(' ')) {
      const query = textBeforeCursor.substring(lastAt + 1);
      setMentionSearch(query);
      setShowMentionDropdown(true);
      setMentionCursorIndex(lastAt);
    } else {
      setShowMentionDropdown(false);
    }

    if (!socket || !activeRoom) return;

    if (!isTypingRef.current) {
      isTypingRef.current = true;
      socket.emit('typing', {
        roomId: activeRoom._id,
        username: currentUser.name || currentUser.username,
        isTyping: true
      });
    }

    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
    }

    typingTimeoutRef.current = setTimeout(() => {
      isTypingRef.current = false;
      socket.emit('typing', {
        roomId: activeRoom._id,
        username: currentUser.name || currentUser.username,
        isTyping: false
      });
    }, 1500);
  };

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream);
      const chunks = [];
      
      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunks.push(e.data);
      };
      
      recorder.onstop = async () => {
        const blob = new Blob(chunks, { type: 'audio/webm' });
        const file = new File([blob], `voice-note-${Date.now()}.webm`, { type: 'audio/webm' });
        await uploadAndSendFile(file);
      };
      
      recorder.start();
      setMediaRecorder(recorder);
      setIsRecording(true);
    } catch (err) {
      console.error('Failed to start voice note recording', err);
      alert('Could not access microphone.');
    }
  };

  const stopRecording = () => {
    if (mediaRecorder && isRecording) {
      mediaRecorder.stop();
      mediaRecorder.stream.getTracks().forEach(t => t.stop());
      setIsRecording(false);
    }
  };

  const cancelRecording = () => {
    if (mediaRecorder && isRecording) {
      mediaRecorder.stream.getTracks().forEach(t => t.stop());
      setIsRecording(false);
      setAudioChunks([]);
    }
  };

  const deleteMessage = (messageId) => {
    if (!window.confirm('Are you sure you want to delete this message?')) return;
    if (socket && activeRoom) {
      socket.emit('delete-message', { messageId, roomId: activeRoom._id });
    }
  };

  const editMessageInitiate = (msg) => {
    setEditingMessageId(msg._id);
    setNewMessage(msg.content);
    setTimeout(() => {
      document.getElementById('chat-input-field')?.focus();
    }, 20);
  };

  const cancelEditing = () => {
    setEditingMessageId(null);
    setNewMessage('');
  };

  const togglePinMessage = (messageId) => {
    if (socket && activeRoom) {
      socket.emit('toggle-pin-message', { messageId, roomId: activeRoom._id });
    }
  };

  const openRoomSettings = () => {
    if (!activeRoom) return;
    setSettingsRoomName(activeRoom.name || '');
    setSettingsRoomMembers(activeRoom.members?.map(m => m._id || m) || []);
    setSettingsRoomArchived(activeRoom.isArchived || false);
    setShowSettingsModal(true);
  };

  const saveRoomSettings = () => {
    if (socket && activeRoom) {
      socket.emit('update-room-settings', {
        roomId: activeRoom._id,
        name: settingsRoomName,
        isArchived: settingsRoomArchived,
        members: settingsRoomMembers
      });
      setShowSettingsModal(false);
    }
  };

  const handleSettingsMemberToggle = (userId) => {
    setSettingsRoomMembers(prev => {
      const exists = prev.includes(userId);
      if (exists) {
        return prev.filter(id => id !== userId);
      }
      return [...prev, userId];
    });
  };

  const handleSendMessage = (e) => {
    e.preventDefault();
    if (!newMessage.trim() || !activeRoom || !socket) return;

    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
    }
    isTypingRef.current = false;
    socket.emit('typing', {
      roomId: activeRoom._id,
      username: currentUser.name || currentUser.username,
      isTyping: false
    });

    if (editingMessageId) {
      socket.emit('edit-message', {
        messageId: editingMessageId,
        newContent: newMessage,
        roomId: activeRoom._id
      });
      setEditingMessageId(null);
    } else {
      socket.emit('send-message', {
        roomId: activeRoom._id,
        senderId: currentUser._id,
        content: newMessage,
        replyTo: replyToMessage ? replyToMessage._id : null
      });
    }
    setNewMessage('');
    setReplyToMessage(null);
  };

  const uploadAndSendFile = async (file) => {
    if (!file || !activeRoom || !socket) return;
    setIsUploading(true);
    try {
      let fileToUpload = file;
      const isImg = file.type?.startsWith('image/') || file.name?.match(/\.(jpg|jpeg|png|gif)$/i);
      
      if (isImg) {
        try {
          const options = { maxSizeMB: 1, maxWidthOrHeight: 1920, useWebWorker: true };
          fileToUpload = await imageCompression(file, options);
        } catch (e) {
          console.warn('Image compression failed, using original file', e);
        }
      }

      const uploadRes = await api.uploadChatFile(fileToUpload);
      const fileUrl = uploadRes.fileUrl;

      socket.emit('send-message', {
        roomId: activeRoom._id,
        senderId: currentUser._id,
        content: isImg ? fileUrl : `Sent a file: ${file.name}`,
        replyTo: replyToMessage ? replyToMessage._id : null,
        attachment: {
          fileName: uploadRes.fileName || file.name,
          fileType: uploadRes.fileType || file.type,
          fileUrl: fileUrl,
          fileSize: uploadRes.fileSize || file.size
        }
      });
      setReplyToMessage(null);
    } catch (error) {
      console.error('File upload failed', error);
      alert('Failed to upload file.');
    } finally {
      setIsUploading(false);
    }
  };

  const handleImageUpload = async (e) => {
    const file = e.target.files?.[0];
    if (file) {
      await uploadAndSendFile(file);
    }
    e.target.value = null;
  };

  const handleToggleReaction = (messageId, emoji) => {
    if (!socket || !activeRoom) return;
    socket.emit('toggle-reaction', {
      messageId,
      emoji,
      userId: currentUser._id,
      roomId: activeRoom._id
    });
  };

  const toggleChecklistItem = (index) => {
    const updatedChecklist = [...editTask.checklist];
    updatedChecklist[index].completed = !updatedChecklist[index].completed;
    setEditTask({ ...editTask, checklist: updatedChecklist });
  };

  const deleteChecklistItem = (index) => {
    const updatedChecklist = editTask.checklist.filter((_, idx) => idx !== index);
    setEditTask({ ...editTask, checklist: updatedChecklist });
  };

  const addChecklistItem = () => {
    if (!newChecklistItem.trim()) return;
    const newItem = { text: newChecklistItem.trim(), completed: false };
    setEditTask({
      ...editTask,
      checklist: [...(editTask.checklist || []), newItem]
    });
    setNewChecklistItem('');
  };

  const addComment = () => {
    if (!newCommentText.trim()) return;
    const newComment = {
      text: newCommentText.trim(),
      sender: currentUser,
      createdAt: new Date().toISOString()
    };
    setEditTask({
      ...editTask,
      comments: [...(editTask.comments || []), newComment]
    });
    setNewCommentText('');
  };

  const addTag = () => {
    if (!newTagText.trim()) return;
    const newTag = { text: newTagText.trim(), color: newTagColor };
    const updatedTags = [...(editTask.tags || []), newTag];
    
    const newActivity = {
      user: currentUser._id,
      action: 'Tag added',
      details: `Added tag "${newTagText}"`,
      createdAt: new Date().toISOString()
    };
    
    setEditTask({
      ...editTask,
      tags: updatedTags,
      activityLogs: [...(editTask.activityLogs || []), newActivity]
    });
    setNewTagText('');
  };

  const removeTag = (index) => {
    const removedTag = editTask.tags[index];
    const updatedTags = editTask.tags.filter((_, idx) => idx !== index);
    
    const newActivity = {
      user: currentUser._id,
      action: 'Tag removed',
      details: `Removed tag "${removedTag.text}"`,
      createdAt: new Date().toISOString()
    };
    
    setEditTask({
      ...editTask,
      tags: updatedTags,
      activityLogs: [...(editTask.activityLogs || []), newActivity]
    });
  };

  const addSubTask = () => {
    if (!newSubTaskTitle.trim()) return;
    const assigneeObj = allUsers.find(u => u._id === newSubTaskAssignee) || null;
    const newSub = {
      title: newSubTaskTitle.trim(),
      completed: false,
      assignee: assigneeObj
    };
    
    const newActivity = {
      user: currentUser._id,
      action: 'Sub-task added',
      details: `Added sub-task "${newSubTaskTitle}"` + (assigneeObj ? ` assigned to ${assigneeObj.name || assigneeObj.username}` : ''),
      createdAt: new Date().toISOString()
    };

    setEditTask({
      ...editTask,
      subTasks: [...(editTask.subTasks || []), newSub],
      activityLogs: [...(editTask.activityLogs || []), newActivity]
    });
    setNewSubTaskTitle('');
    setNewSubTaskAssignee('');
  };

  const toggleSubTask = (index) => {
    const updatedSubs = [...(editTask.subTasks || [])];
    const sub = updatedSubs[index];
    sub.completed = !sub.completed;
    
    const newActivity = {
      user: currentUser._id,
      action: sub.completed ? 'Sub-task completed' : 'Sub-task uncompleted',
      details: `Marked sub-task "${sub.title}" as ${sub.completed ? 'completed' : 'uncompleted'}`,
      createdAt: new Date().toISOString()
    };

    setEditTask({
      ...editTask,
      subTasks: updatedSubs,
      activityLogs: [...(editTask.activityLogs || []), newActivity]
    });
  };

  const deleteSubTask = (index) => {
    const sub = editTask.subTasks[index];
    const updatedSubs = editTask.subTasks.filter((_, idx) => idx !== index);
    
    const newActivity = {
      user: currentUser._id,
      action: 'Sub-task deleted',
      details: `Deleted sub-task "${sub.title}"`,
      createdAt: new Date().toISOString()
    };

    setEditTask({
      ...editTask,
      subTasks: updatedSubs,
      activityLogs: [...(editTask.activityLogs || []), newActivity]
    });
  };

  const addManualTimeLog = () => {
    const hoursVal = parseFloat(manualLogHours);
    if (isNaN(hoursVal) || hoursVal <= 0) {
      alert('Please enter a valid number of hours.');
      return;
    }
    
    const newLog = {
      user: { _id: currentUser._id, name: currentUser.name, username: currentUser.username, email: currentUser.email },
      hours: hoursVal,
      description: manualLogDesc.trim() || 'Logged manually',
      createdAt: new Date().toISOString()
    };

    const newActivity = {
      user: currentUser._id,
      action: 'Time logged',
      details: `Manually logged ${hoursVal} hours: "${manualLogDesc.trim() || 'Logged manually'}"`,
      createdAt: new Date().toISOString()
    };

    setEditTask({
      ...editTask,
      timeLogs: [...(editTask.timeLogs || []), newLog],
      activityLogs: [...(editTask.activityLogs || []), newActivity]
    });
    setManualLogHours('');
    setManualLogDesc('');
  };

  const startStopwatch = (taskId) => {
    if (activeTimerTaskId) {
      alert("A stopwatch is already running on another task! Stop it first.");
      return;
    }
    setActiveTimerTaskId(taskId);
    setTimerSeconds(0);
  };

  const stopStopwatchAndLog = (logDescription = '') => {
    if (!activeTimerTaskId || !editTask) return;
    
    const loggedHours = parseFloat((timerSeconds / 3600).toFixed(4));
    
    const newLog = {
      user: { _id: currentUser._id, name: currentUser.name, username: currentUser.username, email: currentUser.email },
      hours: loggedHours,
      description: logDescription || 'Logged via stopwatch',
      createdAt: new Date().toISOString()
    };
    
    const newActivity = {
      user: currentUser._id,
      action: 'Time logged',
      details: `Logged ${loggedHours} hours via stopwatch: "${logDescription || 'Logged via stopwatch'}"`,
      createdAt: new Date().toISOString()
    };

    setEditTask(prev => ({
      ...prev,
      timeLogs: [...(prev.timeLogs || []), newLog],
      activityLogs: [...(prev.activityLogs || []), newActivity]
    }));

    setActiveTimerTaskId(null);
    setTimerSeconds(0);
  };

  const handleCreateTaskSubmit = (e) => {
    e.preventDefault();
    if (!taskTitle.trim()) return;

    socket.emit('create-task-from-chat', {
      roomId: taskModalMsg.isStandalone ? undefined : activeRoom._id,
      senderId: currentUser._id,
      content: taskModalMsg.content,
      title: taskTitle,
      priority: taskPriority,
      assignees: taskAssignee ? [taskAssignee] : [],
      dueDate: taskDueDate || undefined,
      actorId: currentUser._id,
      tags: [],
      subTasks: []
    });
    
    setTaskModalMsg(null);
    setTaskTitle('');
    setTaskPriority('medium');
    setTaskAssignee('');
    setTaskDueDate('');
    
    // Jump to tasks tab slightly after creating so user sees it
    setTimeout(() => {
      setWorkspaceTab('tasks');
    }, 500);
  };

  const updateTaskStatus = (taskId, newStatus) => {
    socket.emit('update-task-status', { taskId, newStatus, actorId: currentUser._id });
  };

  const handleEditTaskSubmit = (e) => {
    e.preventDefault();
    if (!editTask || !editTask.title.trim()) return;

    socket.emit('update-task-details', {
      taskId: editTask._id,
      title: editTask.title,
      description: editTask.description,
      priority: editTask.priority,
      assignees: editTask.assigneeId ? [editTask.assigneeId] : [],
      dueDate: editTask.dueDate || undefined,
      checklist: editTask.checklist || [],
      comments: editTask.comments || [],
      tags: editTask.tags || [],
      subTasks: editTask.subTasks || [],
      timeLogs: editTask.timeLogs || [],
      activityLogs: editTask.activityLogs || []
    });
    setEditTask(null);
  };

  const handleDeleteTask = () => {
    if (!editTask) return;
    if (window.confirm('Are you sure you want to delete this task?')) {
      socket.emit('delete-task', { taskId: editTask._id });
      setEditTask(null);
    }
  };

  const handleCreateRoomSubmit = async (e) => {
    e.preventDefault();
    if (!newRoomName.trim()) return;
    try {
      const res = await api.createRoom({
        name: newRoomName.trim(),
        type: 'group',
        members: [currentUser._id, ...newRoomMembers]
      });
      if (res.data) {
        setRooms(prev => [...prev, res.data]);
        setActiveRoom(res.data);
        setShowCreateRoomModal(false);
        setNewRoomName('');
        setNewRoomMembers([]);
      }
    } catch (error) {
      console.error('Failed to create group channel', error);
    }
  };

  const handleRoomMemberToggle = (userId) => {
    setNewRoomMembers((prev) => 
      prev.includes(userId) ? prev.filter(id => id !== userId) : [...prev, userId]
    );
  };

  // --- STYLES ---
  const wsStyles = {
    container: { display: 'flex', height: 'calc(100vh - 100px)', gap: '20px' },
    sidebar: { width: '280px', display: 'flex', flexDirection: 'column', gap: '15px', overflowY: 'auto' },
    chatArea: { flex: 1, display: 'flex', flexDirection: 'column', backgroundColor: 'var(--bg-card, #161b26)', borderRadius: '12px', border: '1px solid var(--border-light)', overflow: 'hidden' },
    roomItem: (isActive) => ({ padding: '12px 16px', borderRadius: '8px', display: 'flex', alignItems: 'center', gap: '10px', cursor: 'pointer', backgroundColor: isActive ? 'var(--primary)' : 'transparent', color: isActive ? 'white' : 'var(--text-primary)', transition: 'all 0.2s', fontWeight: isActive ? '500' : '400' }),
    header: { padding: '20px', borderBottom: '1px solid var(--border-light)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' },
    messageList: { flex: 1, padding: '20px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '20px' },
    messageBubble: (isMine, isTask) => ({
      position: 'relative',
      maxWidth: isTask ? '400px' : '70%',
      width: isTask ? '100%' : 'auto',
      padding: isTask ? '0' : '12px 16px',
      borderRadius: '12px',
      backgroundColor: isTask ? 'var(--bg-card, #161b26)' : isMine ? 'var(--primary)' : 'var(--bg-main)',
      color: isTask ? 'var(--text-primary)' : isMine ? 'white' : 'var(--text-primary)',
      borderBottomRightRadius: isMine ? '4px' : '12px',
      borderBottomLeftRadius: !isMine ? '4px' : '12px',
      alignSelf: isMine ? 'flex-end' : 'flex-start',
      boxShadow: '0 2px 5px rgba(0,0,0,0.05)',
      border: isTask ? '1px solid var(--border-light)' : 'none'
    }),
    taskCard: {
      header: { padding: '12px 16px', borderBottom: '1px solid var(--border-light)', backgroundColor: 'rgba(0,0,0,0.02)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTopLeftRadius: '12px', borderTopRightRadius: '12px' },
      body: { padding: '16px', fontSize: '0.9rem', color: 'var(--text-secondary)' },
      footer: { padding: '12px 16px', borderTop: '1px solid var(--border-light)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' },
      statusSelect: (status) => ({
        padding: '6px 12px', borderRadius: '20px', fontSize: '0.8rem', fontWeight: 'bold', border: 'none', cursor: 'pointer', outline: 'none',
        backgroundColor: status === 'Done' ? 'var(--success)' : status === 'In Progress' ? 'var(--warning)' : 'var(--bg-main)',
        color: status === 'To Do' ? 'var(--text-primary)' : 'white'
      }),
      priorityBadge: (priority) => ({
        padding: '4px 8px', borderRadius: '4px', fontSize: '0.7rem', textTransform: 'uppercase', fontWeight: 'bold',
        backgroundColor: priority === 'high' ? 'rgba(239, 68, 68, 0.1)' : priority === 'medium' ? 'rgba(245, 158, 11, 0.1)' : 'rgba(16, 185, 129, 0.1)',
        color: priority === 'high' ? '#ef4444' : priority === 'medium' ? '#f59e0b' : '#10b981'
      })
    },
    messageSender: (isMine) => ({ fontSize: '0.75rem', color: isMine ? 'rgba(255,255,255,0.8)' : 'var(--text-secondary)', marginBottom: '4px', display: 'flex', gap: '8px', justifyContent: isMine ? 'flex-end' : 'flex-start' }),
    inputArea: { padding: '20px', borderTop: '1px solid var(--border-light)', backgroundColor: 'var(--bg-main)' },
    inputForm: { display: 'flex', gap: '10px' },
    inputField: { flex: 1, padding: '12px 20px', borderRadius: '24px', border: '1px solid var(--border-light)', backgroundColor: 'var(--bg-input, #0b0f19)', color: 'var(--text-primary)', outline: 'none' },
    sendBtn: { padding: '12px', borderRadius: '50%', backgroundColor: 'var(--primary)', color: 'white', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' },
    createTaskChip: {
      position: 'absolute', top: '-15px', right: '-10px', backgroundColor: 'var(--accent)', color: 'white', padding: '4px 10px', borderRadius: '16px', fontSize: '0.75rem', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px', boxShadow: '0 4px 6px rgba(0,0,0,0.1)', zIndex: 10, border: 'none'
    },
    modalOverlay: { position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(3, 7, 18, 0.75)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, backdropFilter: 'blur(5px)' },
    modalContent: { width: '450px', backgroundColor: '#161b26', border: '1px solid var(--border-light, rgba(255,255,255,0.08))', borderRadius: '16px', padding: '24px', boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.5), 0 10px 10px -5px rgba(0, 0, 0, 0.4)', color: 'var(--text-primary)' },
    modalContentLarge: { width: '800px', maxWidth: '90%', backgroundColor: '#161b26', border: '1px solid var(--border-light, rgba(255,255,255,0.08))', borderRadius: '16px', padding: '24px', boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.5), 0 10px 10px -5px rgba(0, 0, 0, 0.4)', color: 'var(--text-primary)', display: 'flex', flexDirection: 'column', maxHeight: '90vh', overflowY: 'auto' },
    kanbanContainer: { display: 'flex', gap: '20px', height: '100%', overflowX: 'auto', paddingBottom: '20px' },
    kanbanColumn: { flex: '1', minWidth: '300px', backgroundColor: 'rgba(22, 27, 38, 0.65)', backdropFilter: 'blur(10px)', WebkitBackdropFilter: 'blur(10px)', borderRadius: '16px', display: 'flex', flexDirection: 'column', overflow: 'hidden', border: '1px solid rgba(255, 255, 255, 0.08)' },
    kanbanColHeader: { padding: '15px 20px', fontWeight: 'bold', fontSize: '1rem', borderBottom: '1px solid var(--border-light)', backgroundColor: 'rgba(0,0,0,0.02)' },
    kanbanColBody: { padding: '15px', display: 'flex', flexDirection: 'column', gap: '15px', overflowY: 'auto', flex: 1 }
  };

  const renderDescription = (desc) => {
    if (desc && desc.startsWith('http') && (desc.includes('.s3.') || desc.includes('/uploads/'))) {
      return <img src={desc} alt="Task Context" style={{ maxWidth: '100%', borderRadius: '8px', marginTop: '10px' }} />;
    }
    return `"${desc}"`;
  };

  const getDueDateAlertStyle = (task) => {
    if (!task.dueDate || task.status === 'Done') return {};
    const dueTime = new Date(task.dueDate).getTime();
    const nowTime = new Date().getTime();
    const diffMs = dueTime - nowTime;
    const diffHrs = diffMs / (1000 * 60 * 60);
    
    if (diffMs < 0) {
      return { border: '1.5px solid #ef4444', boxShadow: '0 0 10px rgba(239, 68, 68, 0.3)' };
    } else if (diffHrs <= 24) {
      return { border: '1.5px solid #f59e0b', boxShadow: '0 0 10px rgba(245, 158, 11, 0.3)' };
    }
    return {};
  };

  const renderGanttView = () => {
    const today = new Date();
    const currentYear = today.getFullYear();
    const currentMonth = today.getMonth();
    const monthName = today.toLocaleString('default', { month: 'long' });
    
    const daysInMonth = new Date(currentYear, currentMonth + 1, 0).getDate();
    const daysArray = Array.from({ length: daysInMonth }, (_, i) => i + 1);

    return (
      <div className="glass-panel" style={{ padding: '20px', borderRadius: '16px', display: 'flex', flexDirection: 'column', overflow: 'hidden', border: '1px solid var(--border-light, rgba(255,255,255,0.08))', flex: 1, backgroundColor: 'rgba(22, 27, 38, 0.65)', backdropFilter: 'blur(10px)', WebkitBackdropFilter: 'blur(10px)', marginBottom: '20px' }}>
        <h3 style={{ margin: '0 0 15px 0', fontSize: '1.1rem', color: 'var(--primary)' }}>📅 Gantt Timeline - {monthName} {currentYear}</h3>
        
        <div style={{ overflowX: 'auto', flex: 1 }}>
          <div style={{ minWidth: `${300 + daysInMonth * 40}px` }}>
            {/* Timeline Header Row */}
            <div style={{ display: 'flex', borderBottom: '1px solid var(--border-light, rgba(255,255,255,0.08))', paddingBottom: '8px', fontWeight: 'bold' }}>
              <div style={{ width: '250px', color: 'var(--text-secondary)', fontSize: '0.85rem' }}>Task Details</div>
              <div style={{ display: 'flex', flex: 1 }}>
                {daysArray.map(day => {
                  const isToday = day === today.getDate();
                  return (
                    <div key={day} style={{ width: '40px', textAlign: 'center', fontSize: '0.75rem', color: isToday ? 'var(--primary)' : 'var(--text-secondary)', fontWeight: isToday ? 'bold' : 'normal' }}>
                      {day}
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Tasks Rows */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginTop: '10px' }}>
              {filteredTasks.length === 0 ? (
                <div style={{ padding: '20px', textAlign: 'center', color: 'var(--text-secondary)' }}>No tasks match the filter rules.</div>
              ) : (
                filteredTasks.map(task => {
                  const taskCreated = new Date(task.createdAt);
                  const startDay = taskCreated.getMonth() === currentMonth ? taskCreated.getDate() : 1;
                  
                  let endDay = daysInMonth;
                  if (task.dueDate) {
                    const taskDue = new Date(task.dueDate);
                    if (taskDue.getMonth() === currentMonth) {
                      endDay = taskDue.getDate();
                    }
                  } else {
                    endDay = startDay;
                  }
                  
                  const spanStart = Math.max(1, startDay);
                  const spanEnd = Math.max(spanStart, Math.min(daysInMonth, endDay));
                  const colSpan = (spanEnd - spanStart) + 1;
                  
                  const leftOffsetPercent = ((spanStart - 1) / daysInMonth) * 100;
                  const widthPercent = (colSpan / daysInMonth) * 100;
                  
                  const priorityColor = task.priority === 'high' ? '#ef4444' : task.priority === 'medium' ? '#f59e0b' : '#10b981';

                  return (
                    <div key={task._id} style={{ display: 'flex', alignItems: 'center', padding: '8px 0', borderBottom: '1px solid rgba(255,255,255,0.02)' }}>
                      {/* Task Info Column */}
                      <div 
                        onClick={() => {
                          const assigneeId = task.assignees && task.assignees[0] ? task.assignees[0]._id : '';
                          setEditTask({
                            _id: task._id,
                            title: task.title,
                            description: task.description || '',
                            priority: task.priority || 'medium',
                            assigneeId,
                            dueDate: task.dueDate ? new Date(task.dueDate).toISOString().split('T')[0] : '',
                            checklist: task.checklist || [],
                            comments: task.comments || [],
                            tags: task.tags || [],
                            subTasks: task.subTasks || [],
                            timeLogs: task.timeLogs || [],
                            activityLogs: task.activityLogs || []
                          });
                        }}
                        style={{ width: '250px', paddingRight: '15px', cursor: 'pointer' }}
                      >
                        <div style={{ fontWeight: 'bold', fontSize: '0.85rem', color: 'var(--text-primary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }} title={task.title}>
                          {task.title}
                        </div>
                        <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', display: 'flex', gap: '8px', alignItems: 'center' }}>
                          <span style={{ color: priorityColor }}>● {task.priority}</span>
                          <span>({task.status})</span>
                        </div>
                      </div>

                      {/* Gantt Timeline Bar */}
                      <div style={{ display: 'flex', flex: 1, position: 'relative', height: '24px', backgroundColor: 'rgba(255,255,255,0.01)', borderRadius: '4px' }}>
                        <div 
                          style={{
                            position: 'absolute',
                            left: `${leftOffsetPercent}%`,
                            width: `${widthPercent}%`,
                            height: '100%',
                            backgroundColor: priorityColor,
                            borderRadius: '4px',
                            opacity: 0.85,
                            display: 'flex',
                            alignItems: 'center',
                            padding: '0 8px',
                            boxShadow: `0 0 10px ${priorityColor}44`,
                            cursor: 'pointer'
                          }}
                          onClick={() => {
                            const assigneeId = task.assignees && task.assignees[0] ? task.assignees[0]._id : '';
                            setEditTask({
                              _id: task._id,
                              title: task.title,
                              description: task.description || '',
                              priority: task.priority || 'medium',
                              assigneeId,
                              dueDate: task.dueDate ? new Date(task.dueDate).toISOString().split('T')[0] : '',
                              checklist: task.checklist || [],
                              comments: task.comments || [],
                              tags: task.tags || [],
                              subTasks: task.subTasks || [],
                              timeLogs: task.timeLogs || [],
                              activityLogs: task.activityLogs || []
                            });
                          }}
                        >
                          <span style={{ fontSize: '0.7rem', color: '#0b0f19', fontWeight: 'bold', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                            {task.title}
                          </span>
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>
      </div>
    );
  };

  const renderKanbanCard = (task) => {
    const alertStyle = getDueDateAlertStyle(task);
    return (
      <div 
        key={task._id} 
        draggable={true}
        onDragStart={() => setDraggedTaskId(task._id)}
        onClick={() => {
          const assigneeId = task.assignees && task.assignees[0] ? task.assignees[0]._id : '';
          setEditTask({
            _id: task._id,
            title: task.title,
            description: task.description || '',
            priority: task.priority || 'medium',
            assigneeId,
            dueDate: task.dueDate ? new Date(task.dueDate).toISOString().split('T')[0] : '',
            checklist: task.checklist || [],
            comments: task.comments || [],
            tags: task.tags || [],
            subTasks: task.subTasks || [],
            timeLogs: task.timeLogs || [],
            activityLogs: task.activityLogs || []
          });
        }}
        style={{
          backgroundColor: 'var(--bg-main, #0b0f19)',
          borderRadius: '12px',
          border: '1px solid var(--border-light, rgba(255,255,255,0.08))',
          borderLeft: `4px solid ${
            task.priority === 'high' ? '#ef4444' : task.priority === 'medium' ? '#f59e0b' : '#10b981'
          }`,
          boxShadow: '0 2px 5px rgba(0,0,0,0.05)',
          cursor: 'grab',
          userSelect: 'none',
          transition: 'all 0.25s ease',
          marginBottom: '12px',
          ...alertStyle
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.transform = 'translateY(-3px) scale(1.01)';
          if (!alertStyle.border) {
            e.currentTarget.style.boxShadow = '0 8px 16px rgba(0,0,0,0.25)';
            e.currentTarget.style.borderColor = 'var(--primary)';
          }
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.transform = 'none';
          e.currentTarget.style.boxShadow = alertStyle.boxShadow || '0 2px 5px rgba(0,0,0,0.05)';
          e.currentTarget.style.borderColor = alertStyle.border ? '#ef4444' : 'var(--border-light, rgba(255,255,255,0.08))';
        }}
      >
        <div style={wsStyles.taskCard.header}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <CheckSquare size={16} color="var(--primary)" />
            <strong style={{ color: 'var(--text-primary)' }}>{task.title}</strong>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <span style={wsStyles.taskCard.priorityBadge(task.priority)}>{task.priority}</span>
            {task.dueDate && task.status !== 'Done' && (() => {
              const dueTime = new Date(task.dueDate).getTime();
              const nowTime = new Date().getTime();
              const diffMs = dueTime - nowTime;
              const diffHrs = diffMs / (1000 * 60 * 60);
              if (diffMs < 0) {
                return <span style={{ padding: '2px 6px', borderRadius: '4px', fontSize: '0.7rem', fontWeight: 'bold', backgroundColor: '#ef4444', color: 'white' }}>Overdue</span>;
              } else if (diffHrs <= 24) {
                return <span style={{ padding: '2px 6px', borderRadius: '4px', fontSize: '0.7rem', fontWeight: 'bold', backgroundColor: '#f59e0b', color: '#0b0f19' }}>Due Soon</span>;
              }
              return null;
            })()}
          </div>
        </div>
      <div style={wsStyles.taskCard.body}>
        {task.tags && task.tags.length > 0 && (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px', marginBottom: '8px' }}>
            {task.tags.map((tag, idx) => (
              <span 
                key={idx} 
                style={{ 
                  padding: '2px 6px', 
                  borderRadius: '4px', 
                  fontSize: '0.7rem', 
                  fontWeight: 'bold', 
                  backgroundColor: tag.color || '#3b82f6', 
                  color: '#ffffff',
                  boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
                }}
              >
                {tag.text}
              </span>
            ))}
          </div>
        )}
        
        {renderDescription(task.description)}
        {task.dueDate && (
          <div style={{ marginTop: '10px', fontSize: '0.8rem', color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: '4px' }}>
            📅 Due: {new Date(task.dueDate).toLocaleDateString()}
          </div>
        )}
        
        {(() => {
          const totalItems = (task.checklist?.length || 0) + (task.subTasks?.length || 0);
          if (totalItems === 0) return null;
          const completedItems = (task.checklist?.filter(c => c.completed).length || 0) + (task.subTasks?.filter(s => s.completed).length || 0);
          const pct = Math.round((completedItems / totalItems) * 100);
          return (
            <div style={{ marginTop: '10px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', color: 'var(--text-secondary)', marginBottom: '4px' }}>
                <span>📋 Progress</span>
                <span>{completedItems}/{totalItems} ({pct}%)</span>
              </div>
              <div style={{ height: '6px', borderRadius: '3px', backgroundColor: 'rgba(255,255,255,0.05)', overflow: 'hidden', border: '1px solid rgba(255,255,255,0.02)' }}>
                <div style={{ height: '100%', width: `${pct}%`, backgroundColor: pct === 100 ? '#10b981' : 'var(--primary)', transition: 'width 0.3s ease', borderRadius: '3px' }} />
              </div>
            </div>
          );
        })()}
      </div>
      <div style={wsStyles.taskCard.footer}>
        <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
          {task.roomId?.name && task.roomId.type !== 'direct' ? `Room: #${task.roomId.name}` : ''}
          {task.assignees?.length > 0 ? ` • Assigned to: ${task.assignees.map(a => a.name || a.username).join(', ')}` : ''}
        </span>
        <select 
          value={task.status} 
          onClick={(e) => e.stopPropagation()} // Prevent opening details modal when selecting status
          onChange={(e) => updateTaskStatus(task._id, e.target.value)}
          style={wsStyles.taskCard.statusSelect(task.status)}
        >
          <option value="To Do">To Do</option>
          <option value="In Progress">In Progress</option>
          <option value="Done">Done</option>
        </select>
      </div>
    </div>
    );
  };

  const escapeRegExp = (string) => {
    return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  };

  const filteredTasks = boardTasks.filter(t => {
    if (taskFilter === 'my-tasks') {
      if (!t.assignees?.some(a => a._id === currentUser._id)) return false;
    }
    if (selectedFilterTags.length > 0) {
      if (!t.tags?.some(tag => selectedFilterTags.includes(tag.text))) return false;
    }
    if (taskSearchQuery.trim()) {
      return t.title.toLowerCase().includes(taskSearchQuery.toLowerCase());
    }
    return true;
  });

  const groupRooms = rooms.filter(r => r.type !== 'direct');
  const otherUsers = allUsers.filter(u => u._id !== currentUser._id);
  
  // Message content formatter for Markdown & Download Links
  const renderMessageContent = (content) => {
    if (!content) return null;

    const highlightText = (text) => {
      if (!text) return text;
      const mentionRegex = /(@\w+)/g;
      const searchRegex = searchQuery.trim() ? new RegExp(`(${escapeRegExp(searchQuery)})`, 'gi') : null;
      
      let parts = [text];
      if (searchRegex) {
        parts = text.split(searchRegex);
      }
      
      return parts.flatMap((part, index) => {
        if (searchRegex && searchRegex.test(part)) {
          return <mark key={`search-${index}`} style={{ background: '#facc15', color: '#111827', padding: '0 2px', borderRadius: '2px' }}>{part}</mark>;
        }
        
        const subParts = part.split(mentionRegex);
        return subParts.map((sub, idx) => {
          if (sub.match(mentionRegex)) {
            return (
              <span key={`mention-${index}-${idx}`} style={{ color: '#38bdf8', fontWeight: 'bold', backgroundColor: 'rgba(56, 189, 248, 0.1)', padding: '0 4px', borderRadius: '4px' }}>
                {sub}
              </span>
            );
          }
          return sub;
        });
      });
    };

    const formatLine = (line) => {
      const urlRegex = /(https?:\/\/[^\s]+)/g;
      const parts = line.split(urlRegex);
      
      return parts.map((part, index) => {
        if (part.match(urlRegex)) {
          const isPdf = part.includes('/report/pdf');
          if (isPdf) {
            return (
              <span key={index} style={{ display: 'block', marginTop: '6px', marginBottom: '6px' }}>
                <a 
                  href={part} 
                  download
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '8px',
                    backgroundColor: 'rgba(59, 130, 246, 0.15)',
                    border: '1px solid rgba(59, 130, 246, 0.3)',
                    color: '#60a5fa',
                    padding: '8px 16px',
                    borderRadius: '8px',
                    fontSize: '0.85rem',
                    fontWeight: 'bold',
                    textDecoration: 'none',
                    cursor: 'pointer',
                    transition: 'all 0.2s',
                    boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
                  }}
                  onMouseEnter={(e) => {
                    e.target.style.backgroundColor = 'rgba(59, 130, 246, 0.25)';
                    e.target.style.borderColor = 'rgba(59, 130, 246, 0.5)';
                  }}
                  onMouseLeave={(e) => {
                    e.target.style.backgroundColor = 'rgba(59, 130, 246, 0.15)';
                    e.target.style.borderColor = 'rgba(59, 130, 246, 0.3)';
                  }}
                >
                  📥 Click to Download PDF Report
                </a>
              </span>
            );
          }
          return (
            <a 
              key={index} 
              href={part} 
              target="_blank" 
              rel="noopener noreferrer" 
              style={{ color: 'var(--primary, #3b82f6)', textDecoration: 'underline', wordBreak: 'break-all' }}
            >
              {part}
            </a>
          );
        }
        
        // Parse bold *text*
        const boldRegex = /\*([^*]+)\*/g;
        const boldParts = part.split(boldRegex);
        return boldParts.map((subPart, subIndex) => {
          if (subIndex % 2 === 1) {
            return <strong key={subIndex} style={{ color: 'var(--text-primary, #ffffff)' }}>{highlightText(subPart)}</strong>;
          }
          return highlightText(subPart);
        });
      });
    };

    const lines = content.split('\n');
    return (
      <div style={{ whiteSpace: 'pre-wrap', lineHeight: '1.6', color: '#e5e7eb' }}>
        {lines.map((line, idx) => (
          <div key={idx} style={{ minHeight: '1.2em' }}>
            {formatLine(line)}
          </div>
        ))}
      </div>
    );
  };

  // Helper to get active room display name
  const getActiveRoomName = () => {
    if (!activeRoom) return '';
    if (activeRoom.type === 'direct') {
      const otherMember = activeRoom.members?.find(m => m._id !== currentUser._id);
      return otherMember ? (otherMember.name || otherMember.username) : activeRoom.name;
    }
    return activeRoom.name;
  };

  return (
    <div style={{ padding: '20px', height: '100%', display: 'flex', flexDirection: 'column' }}>
      
      {/* Top Header & Tab Toggles */}
      <div style={{ display: 'flex', alignItems: 'center', marginBottom: '20px', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
          <h2 style={{ margin: 0, fontSize: '1.5rem', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '10px' }}>
            <MessageSquare size={24} color="var(--primary)" /> Team Workspace
          </h2>
          <div style={{ padding: '4px 8px', borderRadius: '12px', fontSize: '0.8rem', backgroundColor: connected ? 'var(--success)' : 'var(--danger)', color: 'white' }}>
            {connected ? 'Live' : 'Offline'}
          </div>
        </div>

        <div style={{ display: 'flex', gap: '10px', backgroundColor: 'var(--bg-card, #161b26)', padding: '4px', borderRadius: '24px', border: '1px solid var(--border-light)' }}>
          <button 
            onClick={() => setWorkspaceTab('chat')} 
            style={{ padding: '8px 24px', borderRadius: '20px', border: 'none', background: workspaceTab === 'chat' ? 'var(--primary)' : 'transparent', color: workspaceTab === 'chat' ? 'white' : 'var(--text-secondary)', cursor: 'pointer', fontWeight: 'bold', transition: 'all 0.2s' }}
          >
            Chat Rooms
          </button>
          <button 
            onClick={() => setWorkspaceTab('tasks')} 
            style={{ padding: '8px 24px', borderRadius: '20px', border: 'none', background: workspaceTab === 'tasks' ? 'var(--primary)' : 'transparent', color: workspaceTab === 'tasks' ? 'white' : 'var(--text-secondary)', cursor: 'pointer', fontWeight: 'bold', transition: 'all 0.2s' }}
          >
            Task Board
          </button>
        </div>
      </div>

      <div style={wsStyles.container}>
        
        {workspaceTab === 'chat' && (
          <>
            {/* Left Sidebar: Channels & DMs */}
            <div className="glass-panel" style={wsStyles.sidebar}>
              <div style={{ marginBottom: '10px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px' }}>
                  <h3 style={{ margin: 0, fontSize: '0.9rem', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '1px' }}>Channels</h3>
                  <button onClick={() => setShowCreateRoomModal(true)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-secondary)' }}><Plus size={16} /></button>
                </div>
                
                <div style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
                  {groupRooms.map(room => (
                    <div key={room._id} style={wsStyles.roomItem(activeRoom?._id === room._id)} onClick={() => setActiveRoom(room)}>
                      <Hash size={18} /><span>{room.name}</span>
                      {unreadCounts[room._id] > 0 && (
                        <div style={{
                          marginLeft: 'auto',
                          padding: '2px 6px',
                          borderRadius: '10px',
                          fontSize: '0.7rem',
                          fontWeight: 'bold',
                          backgroundColor: 'var(--danger, #ef4444)',
                          color: 'white',
                          boxShadow: '0 0 6px var(--danger)'
                        }}>
                          {unreadCounts[room._id]}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px' }}>
                  <h3 style={{ margin: 0, fontSize: '0.9rem', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '1px' }}>Direct Messages</h3>
                </div>
                
                <div style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
                  {otherUsers.map(user => {
                    // Check if a DM room exists for this user to mark active state
                    const existingRoom = rooms.find(r => r.type === 'direct' && r.members?.some(m => (m._id || m) === user._id));
                    const isActive = existingRoom && activeRoom?._id === existingRoom._id;
                    const isOnline = onlineUsers.includes(user._id);
                    return (
                      <div key={user._id} style={wsStyles.roomItem(isActive)} onClick={() => handleUserDMClick(user)}>
                        <div style={{
                          width: '8px',
                          height: '8px',
                          borderRadius: '50%',
                          backgroundColor: isOnline ? 'var(--success, #34d399)' : '#4b5563',
                          boxShadow: isOnline ? '0 0 6px var(--success)' : 'none'
                        }}></div>
                        <span>{user.name || user.username}</span>
                        {existingRoom && unreadCounts[existingRoom._id] > 0 && (
                          <div style={{
                            marginLeft: 'auto',
                            padding: '2px 6px',
                            borderRadius: '10px',
                            fontSize: '0.7rem',
                            fontWeight: 'bold',
                            backgroundColor: 'var(--danger, #ef4444)',
                            color: 'white',
                            boxShadow: '0 0 6px var(--danger)'
                          }}>
                            {unreadCounts[existingRoom._id]}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* Right Area: Chat Stream */}
            <div 
              style={{ ...wsStyles.chatArea, position: 'relative' }}
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
            >
              {activeRoom ? (
                <div style={{ display: 'flex', width: '100%', height: '100%', overflow: 'hidden' }}>
                  <div style={{ flex: 1, display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden', position: 'relative' }}>
                    {isDragging && (
                    <div style={{
                      position: 'absolute',
                      inset: 0,
                      backgroundColor: 'rgba(56, 189, 248, 0.12)',
                      border: '2px dashed var(--primary)',
                      borderRadius: '12px',
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      justifyContent: 'center',
                      zIndex: 100,
                      backdropFilter: 'blur(4px)',
                      pointerEvents: 'none'
                    }}>
                      <span style={{ fontSize: '3rem', marginBottom: '10px' }}>📥</span>
                      <h3 style={{ margin: 0, color: 'var(--primary)' }}>Drop file to upload to chat</h3>
                    </div>
                  )}
                  {/* Header */}
                  <div style={wsStyles.header}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                      {activeRoom.type === 'direct' ? <Users size={24} color="var(--primary)" /> : <Hash size={24} color="var(--primary)" />}
                      <h3 style={{ margin: 0, fontSize: '1.2rem' }}>{getActiveRoomName()}</h3>
                    </div>
                    
                    <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
                      {/* Chat Search input */}
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', width: '220px' }}>
                        <input 
                          type="text" 
                          placeholder="Search messages..." 
                          value={searchQuery} 
                          onChange={(e) => setSearchQuery(e.target.value)} 
                          style={{
                            width: '100%',
                            padding: '6px 12px',
                            borderRadius: '16px',
                            border: '1px solid var(--border-light, rgba(255,255,255,0.08))',
                            backgroundColor: 'var(--bg-input, #0b0f19)',
                            color: 'var(--text-primary)',
                            fontSize: '0.85rem',
                            outline: 'none'
                          }} 
                        />
                        {searchQuery && (
                          <button onClick={() => setSearchQuery('')} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-secondary)', marginLeft: '-30px', marginRight: '10px' }}>
                            <X size={14} />
                          </button>
                        )}
                      </div>
                      
                      {/* Pinned Messages Button */}
                      <button
                        onClick={() => setShowPinsDrawer(prev => !prev)}
                        style={{
                          background: 'none',
                          border: 'none',
                          cursor: 'pointer',
                          color: showPinsDrawer ? '#facc15' : 'var(--text-secondary)',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '4px',
                          fontSize: '0.85rem'
                        }}
                        title="Pinned Messages"
                      >
                        <Pin size={18} fill={showPinsDrawer ? '#facc15' : 'none'} />
                      </button>
                      
                      {/* Room settings gear (only for group channels) */}
                      {activeRoom.type !== 'direct' && (
                        <button
                          onClick={openRoomSettings}
                          style={{
                            background: 'none',
                            border: 'none',
                            cursor: 'pointer',
                            color: 'var(--text-secondary)',
                            display: 'flex',
                            alignItems: 'center'
                          }}
                          title="Channel Settings"
                        >
                          <Settings size={18} />
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Messages */}
                  <div style={wsStyles.messageList} onScroll={handleScroll}>
                    {messages.length === 0 ? (
                      <div style={{ margin: 'auto', color: 'var(--text-secondary)' }}>No messages in this channel yet.</div>
                    ) : (
                      (() => {
                        const filteredMessages = messages.filter(msg => {
                          if (!searchQuery.trim()) return true;
                          return msg.content && msg.content.toLowerCase().includes(searchQuery.toLowerCase());
                        });

                        if (filteredMessages.length === 0) {
                          return <div style={{ margin: 'auto', color: 'var(--text-secondary)' }}>No matching messages found.</div>;
                        }

                        return filteredMessages.map(msg => {
                          const isMine = msg.senderId?._id === currentUser._id;
                          const isTask = msg.type === 'task-card';
                          
                          return (
                            <div key={msg._id} id={`msg-${msg._id}`} style={{ display: 'flex', flexDirection: 'column', transition: 'background-color 0.5s ease', borderRadius: '8px' }}>
                              <div style={wsStyles.messageSender(isMine && !isTask)}>
                                <span>{msg.senderId?.name || msg.senderId?.username || 'System'}</span>
                                <span style={{ display: 'inline-flex', alignItems: 'center' }}>
                                  {new Date(msg.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                  {renderReadReceipt(msg)}
                                </span>
                              </div>
                              
                              <div 
                                style={wsStyles.messageBubble(isMine, isTask)}
                                onMouseEnter={() => !isTask && setHoveredMessageId(msg._id)}
                                onMouseLeave={() => !isTask && setHoveredMessageId(null)}
                              >
                                {/* TASK CARD RENDERING in CHAT */}
                                {isTask && msg.taskId ? (
                                   <div>
                                     <div style={wsStyles.taskCard.header}>
                                       <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                         <CheckSquare size={16} color="var(--primary)" />
                                         <strong 
                                           onClick={() => setEditTask(msg.taskId)} 
                                           style={{ color: 'var(--text-primary)', cursor: 'pointer', textDecoration: 'underline' }}
                                           title="Click to edit task details"
                                         >
                                           {msg.taskId.title}
                                         </strong>
                                       </div>
                                       <span style={wsStyles.taskCard.priorityBadge(msg.taskId.priority)}>{msg.taskId.priority}</span>
                                     </div>
                                     <div style={wsStyles.taskCard.body}>
                                       {renderDescription(msg.taskId.description)}
                                       {msg.taskId.dueDate && (
                                         <div style={{ marginTop: '10px', fontSize: '0.8rem', color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: '4px' }}>
                                           📅 Due: {new Date(msg.taskId.dueDate).toLocaleDateString()}
                                         </div>
                                       )}
                                       {msg.taskId.checklist && msg.taskId.checklist.length > 0 && (
                                         <div style={{ marginTop: '8px', display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                                           📋 {msg.taskId.checklist.filter(c => c.completed).length} / {msg.taskId.checklist.length} Checklist Items
                                         </div>
                                       )}
                                       {msg.taskId.comments && msg.taskId.comments.length > 0 && (
                                         <div style={{ marginTop: '4px', display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                                           💬 {msg.taskId.comments.length} Comments
                                         </div>
                                       )}
                                     </div>
                                    <div style={wsStyles.taskCard.footer}>
                                      <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                                        Assigned to: {msg.taskId.assignees?.length > 0 ? msg.taskId.assignees.map(a => a.name || a.username).join(', ') : 'Unassigned'}
                                      </span>
                                      <select 
                                        value={msg.taskId.status} 
                                        onChange={(e) => updateTaskStatus(msg.taskId._id, e.target.value)}
                                        style={wsStyles.taskCard.statusSelect(msg.taskId.status)}
                                      >
                                        <option value="To Do">To Do</option>
                                        <option value="In Progress">In Progress</option>
                                        <option value="Done">Done</option>
                                      </select>
                                    </div>
                                  </div>
                                ) : (
                                  // STANDARD TEXT RENDERING
                                  <>
                                    {msg.isPinned && (
                                      <div style={{
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: '4px',
                                        fontSize: '0.7rem',
                                        color: '#facc15',
                                        marginBottom: '6px',
                                        fontWeight: 'bold'
                                      }}>
                                        <Pin size={10} fill="#facc15" /> Pinned
                                      </div>
                                    )}

                                    {/* Quoted Reply Display */}
                                    {msg.replyTo && (
                                      <div style={{
                                        padding: '8px 12px',
                                        backgroundColor: isMine ? 'rgba(0,0,0,0.15)' : 'var(--bg-main)',
                                        borderLeft: '3px solid var(--primary)',
                                        borderRadius: '4px',
                                        marginBottom: '8px',
                                        fontSize: '0.8rem',
                                        color: 'var(--text-secondary)',
                                        maxWidth: '100%',
                                        cursor: 'pointer'
                                      }}
                                      onClick={() => {
                                        const el = document.getElementById(`msg-${msg.replyTo._id || msg.replyTo}`);
                                        if (el) {
                                          el.scrollIntoView({ behavior: 'smooth', block: 'center' });
                                          el.style.backgroundColor = 'rgba(56, 189, 248, 0.15)';
                                          setTimeout(() => {
                                            el.style.backgroundColor = '';
                                          }, 1500);
                                        }
                                      }}
                                      >
                                        <div style={{ fontWeight: 'bold', color: 'var(--primary)', marginBottom: '2px' }}>
                                          {msg.replyTo.senderId?.name || msg.replyTo.senderId?.username || 'User'}
                                        </div>
                                        <div style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                          {msg.replyTo.content}
                                        </div>
                                      </div>
                                    )}

                                    {/* Message Body */}
                                    <div style={{ display: 'flex', alignItems: 'baseline', flexWrap: 'wrap' }}>
                                      {msg.attachment ? (
                                        renderAttachment(msg.attachment)
                                      ) : msg.content.startsWith('http') && (msg.content.includes('.s3.') || msg.content.includes('/uploads/')) && (msg.content.endsWith('.png') || msg.content.endsWith('.jpg') || msg.content.endsWith('.jpeg') || msg.content.endsWith('.gif') || msg.content.includes('image')) ? (
                                        <img src={msg.content} alt="Attachment" style={{ maxWidth: '100%', borderRadius: '8px' }} />
                                      ) : (
                                        renderMessageContent(msg.content)
                                      )}
                                      
                                      {msg.isEdited && (
                                        <span style={{ fontSize: '0.7rem', color: 'var(--text-muted, #8892a4)', marginLeft: '6px', fontStyle: 'italic', alignSelf: 'flex-end', marginBottom: '2px' }} title="Edited">
                                          (edited)
                                        </span>
                                      )}
                                    </div>

                                    {/* Hover Action Bar */}
                                    {hoveredMessageId === msg._id && !isTask && (
                                      <div style={{
                                        position: 'absolute',
                                        top: '-24px',
                                        right: isMine ? '0px' : 'auto',
                                        left: !isMine ? '0px' : 'auto',
                                        backgroundColor: '#1f2937',
                                        border: '1px solid rgba(255,255,255,0.08)',
                                        borderRadius: '16px',
                                        padding: '2px 8px',
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: '6px',
                                        boxShadow: '0 4px 6px rgba(0,0,0,0.15)',
                                        zIndex: 10
                                      }}>
                                        {['👍', '❤️', '🔥', '👏', '😂', '😮'].map(emoji => (
                                          <button 
                                            key={emoji}
                                            type="button"
                                            onClick={() => handleToggleReaction(msg._id, emoji)}
                                            style={{
                                              background: 'none',
                                              border: 'none',
                                              cursor: 'pointer',
                                              fontSize: '1rem',
                                              padding: '2px',
                                              transition: 'transform 0.1s',
                                            }}
                                            onMouseEnter={(e) => e.target.style.transform = 'scale(1.3)'}
                                            onMouseLeave={(e) => e.target.style.transform = 'scale(1)'}
                                          >
                                            {emoji}
                                          </button>
                                        ))}
                                        <div style={{ width: '1px', height: '12px', backgroundColor: 'rgba(255,255,255,0.15)', margin: '0 4px' }} />
                                        <button 
                                          type="button"
                                          onClick={() => setReplyToMessage(msg)}
                                          style={{
                                            background: 'none',
                                            border: 'none',
                                            cursor: 'pointer',
                                            color: 'var(--text-secondary)',
                                            fontSize: '0.75rem',
                                            display: 'flex',
                                            alignItems: 'center',
                                            gap: '2px'
                                          }}
                                        >
                                          Reply
                                        </button>
                                        <button 
                                          type="button"
                                          onClick={() => setTaskModalMsg(msg)}
                                          style={{
                                            background: 'none',
                                            border: 'none',
                                            cursor: 'pointer',
                                            color: 'var(--text-secondary)',
                                            fontSize: '0.75rem',
                                            display: 'flex',
                                            alignItems: 'center',
                                            gap: '2px'
                                          }}
                                        >
                                          Task
                                        </button>
                                        <button 
                                          type="button"
                                          onClick={() => togglePinMessage(msg._id)}
                                          style={{
                                            background: 'none',
                                            border: 'none',
                                            cursor: 'pointer',
                                            color: msg.isPinned ? '#facc15' : 'var(--text-secondary)',
                                            fontSize: '0.75rem',
                                            display: 'flex',
                                            alignItems: 'center',
                                            gap: '2px'
                                          }}
                                        >
                                          <Pin size={12} fill={msg.isPinned ? '#facc15' : 'none'} /> Pin
                                        </button>
                                        {isMine && !msg.isDeleted && (
                                          <>
                                            <button 
                                              type="button"
                                              onClick={() => editMessageInitiate(msg)}
                                              style={{
                                                background: 'none',
                                                border: 'none',
                                                cursor: 'pointer',
                                                color: 'var(--text-secondary)',
                                                fontSize: '0.75rem',
                                                display: 'flex',
                                                alignItems: 'center',
                                                gap: '2px'
                                              }}
                                            >
                                              <Edit2 size={12} /> Edit
                                            </button>
                                            <button 
                                              type="button"
                                              onClick={() => deleteMessage(msg._id)}
                                              style={{
                                                background: 'none',
                                                border: 'none',
                                                cursor: 'pointer',
                                                color: '#ef4444',
                                                fontSize: '0.75rem',
                                                display: 'flex',
                                                alignItems: 'center',
                                                gap: '2px'
                                              }}
                                            >
                                              <Trash2 size={12} /> Delete
                                            </button>
                                          </>
                                        )}
                                      </div>
                                    )}

                                    {/* Emojis Reactions List */}
                                    {msg.reactions && msg.reactions.length > 0 && (
                                      <div style={{
                                        display: 'flex',
                                        flexWrap: 'wrap',
                                        gap: '4px',
                                        marginTop: '6px',
                                        justifyContent: isMine ? 'flex-end' : 'flex-start'
                                      }}>
                                        {Object.entries(
                                          msg.reactions.reduce((acc, r) => {
                                            acc[r.emoji] = acc[r.emoji] || [];
                                            acc[r.emoji].push(r);
                                            return acc;
                                          }, {})
                                        ).map(([emoji, reacts]) => {
                                          const hasReacted = reacts.some(r => String(r.user?._id || r.user) === String(currentUser._id));
                                          return (
                                            <button
                                              key={emoji}
                                              type="button"
                                              onClick={() => handleToggleReaction(msg._id, emoji)}
                                              style={{
                                                display: 'flex',
                                                alignItems: 'center',
                                                gap: '4px',
                                                backgroundColor: hasReacted ? 'rgba(56, 189, 248, 0.25)' : 'rgba(255, 255, 255, 0.05)',
                                                border: `1px solid ${hasReacted ? 'var(--primary)' : 'rgba(255,255,255,0.08)'}`,
                                                borderRadius: '12px',
                                                padding: '2px 8px',
                                                fontSize: '0.75rem',
                                                cursor: 'pointer',
                                                color: hasReacted ? '#60a5fa' : 'var(--text-secondary)',
                                                transition: 'all 0.2s',
                                              }}
                                              title={reacts.map(r => r.user?.name || r.user?.username || 'Unknown').join(', ')}
                                            >
                                              <span>{emoji}</span>
                                              <span>{reacts.length}</span>
                                            </button>
                                          );
                                        })}
                                      </div>
                                    )}
                                  </>
                                )}
                              </div>
                            </div>
                          );
                        });
                      })()
                    )}

                    {/* Typing Indicators */}
                    {Object.keys(typingUsers).length > 0 && (
                      <div style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '8px',
                        padding: '8px 16px',
                        color: 'var(--text-secondary)',
                        fontSize: '0.8rem',
                        alignSelf: 'flex-start'
                      }}>
                        <div style={{ display: 'flex', gap: '3px', alignItems: 'center' }}>
                          <span style={{
                            width: '6px',
                            height: '6px',
                            backgroundColor: 'var(--text-secondary)',
                            borderRadius: '50%',
                            display: 'inline-block',
                            animation: 'bounce 1.4s infinite ease-in-out both'
                          }} />
                          <span style={{
                            width: '6px',
                            height: '6px',
                            backgroundColor: 'var(--text-secondary)',
                            borderRadius: '50%',
                            display: 'inline-block',
                            animation: 'bounce 1.4s infinite ease-in-out both',
                            animationDelay: '0.2s'
                          }} />
                          <span style={{
                            width: '6px',
                            height: '6px',
                            backgroundColor: 'var(--text-secondary)',
                            borderRadius: '50%',
                            display: 'inline-block',
                            animation: 'bounce 1.4s infinite ease-in-out both',
                            animationDelay: '0.4s'
                          }} />
                        </div>
                        <span>
                          {Object.keys(typingUsers).join(', ')} {Object.keys(typingUsers).length === 1 ? 'is' : 'are'} typing...
                        </span>
                      </div>
                    )}

                    <div ref={messagesEndRef} />
                  </div>

                  {/* Input Bar */}
                  <div style={wsStyles.inputArea}>
                    {replyToMessage && (
                      <div style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        padding: '8px 16px',
                        backgroundColor: 'var(--bg-card, #161b26)',
                        borderBottom: '1px solid var(--border-light, rgba(255,255,255,0.08))',
                        borderTopLeftRadius: '12px',
                        borderTopRightRadius: '12px',
                        marginBottom: '8px',
                      }}>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                          <span style={{ fontSize: '0.75rem', color: 'var(--primary)', fontWeight: 'bold' }}>
                            Replying to {replyToMessage.senderId?.name || replyToMessage.senderId?.username || 'System'}
                          </span>
                          <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '400px' }}>
                            {replyToMessage.content}
                          </span>
                        </div>
                        <button 
                          type="button" 
                          onClick={() => setReplyToMessage(null)} 
                          style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-secondary)' }}
                        >
                          <X size={16} />
                        </button>
                      </div>
                    )}

                    {showMentionDropdown && otherUsers.filter(u => (u.name || u.username || '').toLowerCase().includes(mentionSearch.toLowerCase())).length > 0 && (
                      <div style={{
                        position: 'absolute',
                        bottom: '80px',
                        left: '20px',
                        backgroundColor: '#1f2937',
                        border: '1px solid rgba(255, 255, 255, 0.08)',
                        borderRadius: '8px',
                        maxHeight: '150px',
                        overflowY: 'auto',
                        width: '220px',
                        zIndex: 1000,
                        boxShadow: '0 4px 12px rgba(0,0,0,0.4)',
                        display: 'flex',
                        flexDirection: 'column'
                      }}>
                        {otherUsers
                          .filter(u => (u.name || u.username || '').toLowerCase().includes(mentionSearch.toLowerCase()))
                          .map(u => (
                            <div 
                              key={u._id} 
                              onClick={() => insertMention(u)}
                              style={{
                                padding: '8px 12px',
                                cursor: 'pointer',
                                fontSize: '0.85rem',
                                color: 'var(--text-primary)',
                                borderBottom: '1px solid rgba(255, 255, 255, 0.04)',
                                transition: 'background-color 0.15s'
                              }}
                              onMouseEnter={e => e.target.style.backgroundColor = 'rgba(56, 189, 248, 0.15)'}
                              onMouseLeave={e => e.target.style.backgroundColor = 'transparent'}
                            >
                              @{u.username || u.name}
                            </div>
                          ))}
                      </div>
                    )}

                    {editingMessageId && (
                      <div style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        padding: '8px 12px',
                        backgroundColor: 'rgba(234, 179, 8, 0.1)',
                        borderLeft: '3px solid #eab308',
                        borderRadius: '4px',
                        marginBottom: '8px',
                      }}>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                          <span style={{ fontSize: '0.75rem', color: '#eab308', fontWeight: 'bold' }}>
                            Editing Message
                          </span>
                          <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                            Press Esc or click X to cancel
                          </span>
                        </div>
                        <button 
                          type="button" 
                          onClick={cancelEditing} 
                          style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-secondary)' }}
                        >
                          <X size={16} />
                        </button>
                      </div>
                    )}

                    {isRecording && (
                      <div style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        padding: '10px 16px',
                        backgroundColor: 'rgba(239, 68, 68, 0.1)',
                        borderRadius: '8px',
                        marginBottom: '8px',
                        border: '1px solid rgba(239, 68, 68, 0.2)'
                      }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                          <div className="pulse-red" style={{ width: '10px', height: '10px', borderRadius: '50%', backgroundColor: '#ef4444' }}></div>
                          <span style={{ fontSize: '0.9rem', color: '#ef4444', fontWeight: 'bold' }}>Recording Voice Note...</span>
                        </div>
                        <div style={{ display: 'flex', gap: '12px' }}>
                          <button 
                            type="button" 
                            onClick={stopRecording} 
                            style={{ padding: '6px 12px', borderRadius: '6px', border: 'none', backgroundColor: '#ef4444', color: 'white', cursor: 'pointer', fontWeight: 'bold', fontSize: '0.8rem' }}
                          >
                            Send
                          </button>
                          <button 
                            type="button" 
                            onClick={cancelRecording} 
                            style={{ padding: '6px 12px', borderRadius: '6px', border: '1px solid rgba(255,255,255,0.15)', backgroundColor: 'transparent', color: 'var(--text-secondary)', cursor: 'pointer', fontSize: '0.8rem' }}
                          >
                            Cancel
                          </button>
                        </div>
                      </div>
                    )}

                    <form onSubmit={handleSendMessage} style={wsStyles.inputForm}>
                      <button 
                        type="button" 
                        onClick={() => fileInputRef.current?.click()}
                        disabled={isUploading}
                        style={{ ...wsStyles.sendBtn, backgroundColor: 'var(--bg-input, #0b0f19)', color: 'var(--text-secondary)', border: '1px solid var(--border-light)' }}
                        title="Upload file or image"
                      >
                        {isUploading ? <Loader2 size={18} className="animate-spin" /> : <Paperclip size={18} />}
                      </button>
                      <input 
                        type="file" 
                        ref={fileInputRef} 
                        style={{ display: 'none' }} 
                        onChange={handleImageUpload} 
                      />
                      <input 
                        id="chat-input-field" 
                        type="text" 
                        placeholder={editingMessageId ? "Edit your message..." : `Message #${activeRoom.name}...`} 
                        value={newMessage} 
                        onChange={handleInputChange} 
                        style={wsStyles.inputField} 
                        autoComplete="off"
                        onKeyDown={(e) => {
                          if (e.key === 'Escape') {
                            if (editingMessageId) cancelEditing();
                          }
                        }}
                      />
                      
                      {!editingMessageId && (
                        <button
                          type="button"
                          onClick={startRecording}
                          style={{
                            ...wsStyles.sendBtn,
                            backgroundColor: 'var(--bg-input, #0b0f19)',
                            color: 'var(--text-secondary)',
                            border: '1px solid var(--border-light)',
                            marginRight: '8px'
                          }}
                          title="Record voice memo"
                        >
                          <Mic size={18} />
                        </button>
                      )}
                      
                      <button type="submit" style={wsStyles.sendBtn} disabled={!newMessage.trim() || isUploading}><Send size={18} /></button>
                    </form>
                  </div>
                </div>

                {/* Right portion: Pinned messages drawer */}
                  {showPinsDrawer && (
                    <div style={{
                      width: '320px',
                      borderLeft: '1px solid var(--border-light, rgba(255,255,255,0.08))',
                      backgroundColor: 'var(--bg-card, #161b26)',
                      display: 'flex',
                      flexDirection: 'column',
                      height: '100%',
                      overflow: 'hidden'
                    }}>
                      <div style={{
                        padding: '16px',
                        borderBottom: '1px solid var(--border-light, rgba(255,255,255,0.08))',
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center'
                      }}>
                        <h4 style={{ margin: 0, display: 'flex', alignItems: 'center', gap: '8px', color: '#facc15', fontSize: '1rem' }}>
                          <Pin size={16} fill="#facc15" /> Pinned Messages
                        </h4>
                        <button 
                          onClick={() => setShowPinsDrawer(false)} 
                          style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-secondary)' }}
                        >
                          <X size={18} />
                        </button>
                      </div>
                      
                      <div style={{ flex: 1, overflowY: 'auto', padding: '16px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
                        {messages.filter(msg => msg.isPinned).length === 0 ? (
                          <div style={{ margin: 'auto', color: 'var(--text-secondary)', textAlign: 'center', fontSize: '0.9rem' }}>
                            No pinned messages in this room.
                          </div>
                        ) : (
                          messages.filter(msg => msg.isPinned).map(msg => (
                            <div key={msg._id} className="glass-panel" style={{
                              padding: '12px',
                              borderRadius: '8px',
                              border: '1px solid var(--border-light, rgba(255,255,255,0.08))',
                              backgroundColor: 'rgba(255,255,255,0.02)',
                              display: 'flex',
                              flexDirection: 'column',
                              gap: '6px'
                            }}>
                              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                <span style={{ fontSize: '0.8rem', fontWeight: 'bold', color: 'var(--primary)' }}>
                                  {msg.senderId?.name || msg.senderId?.username || 'User'}
                                </span>
                                <button
                                  onClick={() => togglePinMessage(msg._id)}
                                  style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#ef4444', fontSize: '0.75rem' }}
                                  title="Unpin"
                                >
                                  Unpin
                                </button>
                              </div>
                              <div style={{ fontSize: '0.85rem', color: 'var(--text-primary)', wordBreak: 'break-word' }}>
                                {msg.attachment ? renderAttachment(msg.attachment) : msg.content}
                              </div>
                            </div>
                          ))
                        )}
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <div style={{ margin: 'auto', color: 'var(--text-secondary)' }}>Select a channel to start messaging.</div>
              )}
            </div>
          </>
        )}

        {/* Task Board Tab */}
        {workspaceTab === 'tasks' && (
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '15px', flexWrap: 'wrap', gap: '15px' }}>
              <div style={{ display: 'flex', gap: '15px' }}>
                {/* Scope Filters */}
                <div style={{ display: 'flex', gap: '4px', backgroundColor: 'var(--bg-card, #161b26)', padding: '4px', borderRadius: '8px', border: '1px solid var(--border-light)' }}>
                  <button 
                    onClick={() => setTaskFilter('my-tasks')} 
                    style={{ padding: '6px 12px', borderRadius: '4px', border: 'none', background: taskFilter === 'my-tasks' ? 'var(--primary)' : 'transparent', color: taskFilter === 'my-tasks' ? 'white' : 'var(--text-secondary)', cursor: 'pointer', fontWeight: 'bold' }}
                  >
                    My Tasks
                  </button>
                  <button 
                    onClick={() => setTaskFilter('all-tasks')} 
                    style={{ padding: '6px 12px', borderRadius: '4px', border: 'none', background: taskFilter === 'all-tasks' ? 'var(--primary)' : 'transparent', color: taskFilter === 'all-tasks' ? 'white' : 'var(--text-secondary)', cursor: 'pointer', fontWeight: 'bold' }}
                  >
                    All Tasks
                  </button>
                </div>

                {/* View Type Toggle */}
                <div style={{ display: 'flex', gap: '4px', backgroundColor: 'var(--bg-card, #161b26)', padding: '4px', borderRadius: '8px', border: '1px solid var(--border-light)' }}>
                  <button 
                    onClick={() => setWorkspaceTaskTab('board')} 
                    style={{ padding: '6px 12px', borderRadius: '4px', border: 'none', background: workspaceTaskTab === 'board' ? 'var(--primary)' : 'transparent', color: workspaceTaskTab === 'board' ? 'white' : 'var(--text-secondary)', cursor: 'pointer', fontWeight: 'bold' }}
                  >
                    📋 Board View
                  </button>
                  <button 
                    onClick={() => setWorkspaceTaskTab('timeline')} 
                    style={{ padding: '6px 12px', borderRadius: '4px', border: 'none', background: workspaceTaskTab === 'timeline' ? 'var(--primary)' : 'transparent', color: workspaceTaskTab === 'timeline' ? 'white' : 'var(--text-secondary)', cursor: 'pointer', fontWeight: 'bold' }}
                  >
                    📅 Gantt Timeline
                  </button>
                </div>
              </div>

              <div style={{ display: 'flex', gap: '15px', alignItems: 'center' }}>
                <input 
                  type="text" 
                  placeholder="Filter tasks by title..." 
                  value={taskSearchQuery}
                  onChange={(e) => setTaskSearchQuery(e.target.value)}
                  style={{
                    padding: '8px 16px',
                    borderRadius: '8px',
                    border: '1px solid var(--border-light, rgba(255,255,255,0.08))',
                    backgroundColor: 'var(--bg-input, #0b0f19)',
                    color: 'var(--text-primary)',
                    outline: 'none',
                    fontSize: '0.9rem',
                    width: '220px'
                  }}
                />
                <button onClick={() => setTaskModalMsg({ isStandalone: true, content: '' })} style={{ padding: '10px 20px', borderRadius: '8px', border: 'none', backgroundColor: 'var(--primary)', color: 'white', cursor: 'pointer', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <Plus size={18} /> Create New Task
                </button>
             </div>
            </div>

            {/* Tags Multi-Filter Row */}
            {(() => {
              const uniqueTags = [];
              boardTasks.forEach(task => {
                (task.tags || []).forEach(tag => {
                  if (!uniqueTags.some(t => t.text === tag.text)) {
                    uniqueTags.push(tag);
                  }
                });
              });
              
              if (uniqueTags.length === 0) return null;
              
              return (
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap', marginBottom: '15px', padding: '10px 16px', borderRadius: '8px', backgroundColor: 'rgba(255,255,255,0.02)', border: '1px solid var(--border-light, rgba(255,255,255,0.08))' }}>
                  <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', fontWeight: 'bold' }}>🏷️ Filter by Tags:</span>
                  {uniqueTags.map((tag, idx) => {
                    const isSelected = selectedFilterTags.includes(tag.text);
                    return (
                      <button 
                        key={idx} 
                        type="button"
                        onClick={() => {
                          setSelectedFilterTags(prev => 
                            prev.includes(tag.text) 
                              ? prev.filter(t => t !== tag.text) 
                              : [...prev, tag.text]
                          );
                        }}
                        style={{
                          padding: '4px 10px',
                          borderRadius: '20px',
                          fontSize: '0.75rem',
                          fontWeight: 'bold',
                          border: '1px solid',
                          borderColor: tag.color,
                          backgroundColor: isSelected ? tag.color : 'transparent',
                          color: isSelected ? '#ffffff' : tag.color,
                          cursor: 'pointer',
                          transition: 'all 0.2s ease',
                          boxShadow: isSelected ? `0 0 8px ${tag.color}` : 'none'
                        }}
                      >
                        {tag.text} {isSelected ? '✓' : ''}
                      </button>
                    );
                  })}
                  {selectedFilterTags.length > 0 && (
                    <button 
                      type="button" 
                      onClick={() => setSelectedFilterTags([])}
                      style={{ background: 'none', border: 'none', color: '#ef4444', fontSize: '0.75rem', cursor: 'pointer', textDecoration: 'underline' }}
                    >
                      Clear Filters
                    </button>
                  )}
                </div>
              );
            })()}

            {renderKanbanDashboard()}
            
            {workspaceTaskTab === 'timeline' ? renderGanttView() : (
              <div style={wsStyles.kanbanContainer}>
                {/* To Do Column */}
                <div 
                  style={{
                    ...wsStyles.kanbanColumn,
                    border: draggedTaskId ? '2px dashed rgba(56, 189, 248, 0.45)' : '1px solid rgba(255, 255, 255, 0.08)',
                    boxShadow: draggedTaskId ? '0 0 15px rgba(56, 189, 248, 0.05)' : 'none',
                    transition: 'all 0.25s ease'
                  }}
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={() => {
                    if (draggedTaskId) {
                      updateTaskStatus(draggedTaskId, 'To Do');
                      setDraggedTaskId(null);
                    }
                  }}
                >
                  <div style={wsStyles.kanbanColHeader}>To Do <span style={{ color: 'var(--text-secondary)', fontWeight: 'normal', fontSize: '0.8rem', marginLeft: '10px' }}>{filteredTasks.filter(t => t.status === 'To Do').length}</span></div>
                  <div style={wsStyles.kanbanColBody}>
                    {filteredTasks.filter(t => t.status === 'To Do').map(renderKanbanCard)}
                  </div>
                </div>

                {/* In Progress Column */}
                <div 
                  style={{
                    ...wsStyles.kanbanColumn,
                    border: draggedTaskId ? '2px dashed rgba(56, 189, 248, 0.45)' : '1px solid rgba(255, 255, 255, 0.08)',
                    boxShadow: draggedTaskId ? '0 0 15px rgba(56, 189, 248, 0.05)' : 'none',
                    transition: 'all 0.25s ease'
                  }}
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={() => {
                    if (draggedTaskId) {
                      updateTaskStatus(draggedTaskId, 'In Progress');
                      setDraggedTaskId(null);
                    }
                  }}
                >
                  <div style={wsStyles.kanbanColHeader}>In Progress <span style={{ color: 'var(--text-secondary)', fontWeight: 'normal', fontSize: '0.8rem', marginLeft: '10px' }}>{filteredTasks.filter(t => t.status === 'In Progress').length}</span></div>
                  <div style={wsStyles.kanbanColBody}>
                    {filteredTasks.filter(t => t.status === 'In Progress').map(renderKanbanCard)}
                  </div>
                </div>

                {/* Done Column */}
                <div 
                  style={{
                    ...wsStyles.kanbanColumn,
                    border: draggedTaskId ? '2px dashed rgba(56, 189, 248, 0.45)' : '1px solid rgba(255, 255, 255, 0.08)',
                    boxShadow: draggedTaskId ? '0 0 15px rgba(56, 189, 248, 0.05)' : 'none',
                    transition: 'all 0.25s ease'
                  }}
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={() => {
                    if (draggedTaskId) {
                      updateTaskStatus(draggedTaskId, 'Done');
                      setDraggedTaskId(null);
                    }
                  }}
                >
                  <div style={wsStyles.kanbanColHeader}>Done <span style={{ color: 'var(--text-secondary)', fontWeight: 'normal', fontSize: '0.8rem', marginLeft: '10px' }}>{filteredTasks.filter(t => t.status === 'Done').length}</span></div>
                  <div style={wsStyles.kanbanColBody}>
                    {filteredTasks.filter(t => t.status === 'Done').map(renderKanbanCard)}
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

      </div>

      {/* Task Creation Modal */}
      {taskModalMsg && (
        <div style={wsStyles.modalOverlay}>
          <div style={wsStyles.modalContent}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
              <h3 style={{ margin: 0 }}>{taskModalMsg.isStandalone ? 'Create New Task' : 'Create Task from Message'}</h3>
              <button onClick={() => setTaskModalMsg(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-secondary)' }}><X size={20} /></button>
            </div>
            
            <form onSubmit={handleCreateTaskSubmit}>
              <div style={{ marginBottom: '15px' }}>
                <label style={{ display: 'block', marginBottom: '5px', fontSize: '0.9rem', color: 'var(--text-secondary)' }}>Task Title</label>
                <input required autoFocus type="text" value={taskTitle} onChange={e => setTaskTitle(e.target.value)} style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid var(--border-light)', backgroundColor: 'var(--bg-main)', color: 'var(--text-primary)', outline: 'none' }} placeholder="e.g. Update design catalog" />
              </div>

              {!taskModalMsg.isStandalone ? (
                <div style={{ marginBottom: '15px' }}>
                  <label style={{ display: 'block', marginBottom: '5px', fontSize: '0.9rem', color: 'var(--text-secondary)' }}>Message Context</label>
                  <div style={{ padding: '12px', backgroundColor: 'var(--bg-main)', borderLeft: '4px solid var(--primary)', color: 'var(--text-secondary)', fontSize: '0.9rem', borderRadius: '0 8px 8px 0' }}>
                    {renderDescription(taskModalMsg.content)}
                  </div>
                </div>
              ) : (
                <div style={{ marginBottom: '15px' }}>
                  <label style={{ display: 'block', marginBottom: '5px', fontSize: '0.9rem', color: 'var(--text-secondary)' }}>Description (Optional)</label>
                  <textarea value={taskModalMsg.content || ''} onChange={e => setTaskModalMsg({...taskModalMsg, content: e.target.value})} style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid var(--border-light)', backgroundColor: 'var(--bg-main)', color: 'var(--text-primary)', outline: 'none', minHeight: '80px', resize: 'vertical' }} placeholder="Add task details..."></textarea>
                </div>
              )}

              <div style={{ display: 'flex', gap: '15px', marginBottom: '20px' }}>
                <div style={{ flex: 1 }}>
                  <label style={{ display: 'block', marginBottom: '5px', fontSize: '0.9rem', color: 'var(--text-secondary)' }}>Priority</label>
                  <select value={taskPriority} onChange={e => setTaskPriority(e.target.value)} style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid var(--border-light)', backgroundColor: 'var(--bg-main)', color: 'var(--text-primary)', outline: 'none' }}>
                    <option value="low">Low</option>
                    <option value="medium">Medium</option>
                    <option value="high">High</option>
                  </select>
                </div>
                <div style={{ flex: 1 }}>
                  <label style={{ display: 'block', marginBottom: '5px', fontSize: '0.9rem', color: 'var(--text-secondary)' }}>Due Date</label>
                  <input type="date" value={taskDueDate} onChange={e => setTaskDueDate(e.target.value)} style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid var(--border-light)', backgroundColor: 'var(--bg-main)', color: 'var(--text-primary)', outline: 'none' }} />
                </div>
              </div>

              <div style={{ marginBottom: '20px' }}>
                <label style={{ display: 'block', marginBottom: '5px', fontSize: '0.9rem', color: 'var(--text-secondary)' }}>Assign To</label>
                <select value={taskAssignee} onChange={e => setTaskAssignee(e.target.value)} style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid var(--border-light)', backgroundColor: 'var(--bg-main)', color: 'var(--text-primary)', outline: 'none' }}>
                  <option value="">Unassigned</option>
                  {allUsers.map(u => (
                    <option key={u._id} value={u._id}>{u.name || u.username} ({u.email})</option>
                  ))}
                </select>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
                <button type="button" onClick={() => setTaskModalMsg(null)} style={{ padding: '10px 20px', borderRadius: '8px', border: '1px solid var(--border-light)', backgroundColor: 'transparent', color: 'var(--text-primary)', cursor: 'pointer' }}>Cancel</button>
                <button type="submit" style={{ padding: '10px 20px', borderRadius: '8px', border: 'none', backgroundColor: 'var(--primary)', color: '#0b0f19', cursor: 'pointer', fontWeight: 'bold' }}>Create Task</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Task Details & Edit Modal */}
      {editTask && (
        <div style={wsStyles.modalOverlay}>
          <div style={wsStyles.modalContentLarge}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '15px' }}>
              <h3 style={{ margin: 0 }}>Task Details</h3>
              <button onClick={() => setEditTask(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-secondary)' }}><X size={20} /></button>
            </div>
            
            {/* Modal Tabs Header */}
            <div style={{ display: 'flex', gap: '15px', borderBottom: '1px solid var(--border-light)', marginBottom: '20px', paddingBottom: '10px' }}>
              <button 
                type="button"
                onClick={() => setTaskDetailTab('details')}
                style={{ 
                  background: 'none', 
                  border: 'none', 
                  color: taskDetailTab === 'details' ? 'var(--primary)' : 'var(--text-secondary)', 
                  fontWeight: 'bold', 
                  cursor: 'pointer',
                  borderBottom: taskDetailTab === 'details' ? '2px solid var(--primary)' : 'none',
                  paddingBottom: '5px'
                }}
              >
                📋 Details & Sub-Tasks
              </button>
              <button 
                type="button"
                onClick={() => setTaskDetailTab('time')}
                style={{ 
                  background: 'none', 
                  border: 'none', 
                  color: taskDetailTab === 'time' ? 'var(--primary)' : 'var(--text-secondary)', 
                  fontWeight: 'bold', 
                  cursor: 'pointer',
                  borderBottom: taskDetailTab === 'time' ? '2px solid var(--primary)' : 'none',
                  paddingBottom: '5px'
                }}
              >
                ⏱️ Time Sheets
              </button>
              <button 
                type="button"
                onClick={() => setTaskDetailTab('history')}
                style={{ 
                  background: 'none', 
                  border: 'none', 
                  color: taskDetailTab === 'history' ? 'var(--primary)' : 'var(--text-secondary)', 
                  fontWeight: 'bold', 
                  cursor: 'pointer',
                  borderBottom: taskDetailTab === 'history' ? '2px solid var(--primary)' : 'none',
                  paddingBottom: '5px'
                }}
              >
                📜 Activity History
              </button>
            </div>
            
            <form onSubmit={handleEditTaskSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
              <div style={{ display: 'flex', gap: '24px', flexWrap: 'wrap' }}>
                {/* Left Side: Standard fields (Always visible in Details/Time/History tabs to maintain context) */}
                <div style={{ flex: 1, minWidth: '300px', display: 'flex', flexDirection: 'column', gap: '15px' }}>
                  <div>
                    <label style={{ display: 'block', marginBottom: '5px', fontSize: '0.9rem', color: 'var(--text-secondary)' }}>Task Title</label>
                    <input required type="text" value={editTask.title} onChange={e => setEditTask({...editTask, title: e.target.value})} style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid var(--border-light)', backgroundColor: 'var(--bg-main)', color: 'var(--text-primary)', outline: 'none' }} />
                  </div>

                  <div>
                    <label style={{ display: 'block', marginBottom: '5px', fontSize: '0.9rem', color: 'var(--text-secondary)' }}>Description</label>
                    <textarea value={editTask.description} onChange={e => setEditTask({...editTask, description: e.target.value})} style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid var(--border-light)', backgroundColor: 'var(--bg-main)', color: 'var(--text-primary)', outline: 'none', minHeight: '120px', resize: 'vertical' }}></textarea>
                  </div>

                  <div style={{ display: 'flex', gap: '15px' }}>
                    <div style={{ flex: 1 }}>
                      <label style={{ display: 'block', marginBottom: '5px', fontSize: '0.9rem', color: 'var(--text-secondary)' }}>Priority</label>
                      <select value={editTask.priority} onChange={e => setEditTask({...editTask, priority: e.target.value})} style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid var(--border-light)', backgroundColor: 'var(--bg-main)', color: 'var(--text-primary)', outline: 'none' }}>
                        <option value="low">Low</option>
                        <option value="medium">Medium</option>
                        <option value="high">High</option>
                      </select>
                    </div>
                    <div style={{ flex: 1 }}>
                      <label style={{ display: 'block', marginBottom: '5px', fontSize: '0.9rem', color: 'var(--text-secondary)' }}>Due Date</label>
                      <input type="date" value={editTask.dueDate} onChange={e => setEditTask({...editTask, dueDate: e.target.value})} style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid var(--border-light)', backgroundColor: 'var(--bg-main)', color: 'var(--text-primary)', outline: 'none' }} />
                    </div>
                  </div>

                  <div>
                    <label style={{ display: 'block', marginBottom: '5px', fontSize: '0.9rem', color: 'var(--text-secondary)' }}>Assign To</label>
                    <select value={editTask.assigneeId} onChange={e => setEditTask({...editTask, assigneeId: e.target.value})} style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid var(--border-light)', backgroundColor: 'var(--bg-main)', color: 'var(--text-primary)', outline: 'none' }}>
                      <option value="">Unassigned</option>
                      {allUsers.map(u => (
                        <option key={u._id} value={u._id}>{u.name || u.username} ({u.email})</option>
                      ))}
                    </select>
                  </div>
                </div>

                {/* Right Side: Tab Contents */}
                {taskDetailTab === 'details' && (
                  <div style={{ flex: 1, minWidth: '300px', display: 'flex', flexDirection: 'column', gap: '20px' }}>
                    {/* Tags / Labels */}
                    <div style={{ border: '1px solid var(--border-light)', borderRadius: '12px', padding: '16px', backgroundColor: 'rgba(0,0,0,0.1)' }}>
                      <h4 style={{ margin: '0 0 12px 0', fontSize: '0.95rem', display: 'flex', alignItems: 'center', gap: '8px' }}>🏷️ Tags / Labels</h4>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginBottom: '12px' }}>
                        {(editTask.tags || []).length > 0 ? (
                          editTask.tags.map((tag, idx) => (
                            <span key={idx} style={{ padding: '4px 8px', borderRadius: '4px', fontSize: '0.8rem', backgroundColor: tag.color || '#3b82f6', color: 'white', display: 'flex', alignItems: 'center', gap: '6px', fontWeight: 'bold' }}>
                              {tag.text}
                              <button type="button" onClick={() => removeTag(idx)} style={{ background: 'none', border: 'none', color: 'white', cursor: 'pointer', padding: 0, fontWeight: 'bold', fontSize: '0.85rem' }}>×</button>
                            </span>
                          ))
                        ) : (
                          <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>No tags added yet.</span>
                        )}
                      </div>
                      <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                        <input 
                          type="text" 
                          placeholder="Add new tag..." 
                          value={newTagText} 
                          onChange={(e) => setNewTagText(e.target.value)} 
                          style={{ flex: 1, padding: '6px 12px', fontSize: '0.85rem', borderRadius: '6px', border: '1px solid var(--border-light)', backgroundColor: 'var(--bg-main)', color: 'var(--text-primary)' }}
                        />
                        <input 
                          type="color" 
                          value={newTagColor} 
                          onChange={(e) => setNewTagColor(e.target.value)} 
                          style={{ width: '32px', height: '32px', padding: 0, border: 'none', borderRadius: '4px', cursor: 'pointer', backgroundColor: 'transparent' }} 
                        />
                        <button 
                          type="button" 
                          onClick={addTag} 
                          style={{ padding: '6px 12px', fontSize: '0.85rem', borderRadius: '6px', backgroundColor: 'var(--primary)', color: '#0b0f19', fontWeight: 'bold', border: 'none', cursor: 'pointer' }}
                        >
                          Add
                        </button>
                      </div>
                    </div>

                    {/* Checklist */}
                    <div style={{ border: '1px solid var(--border-light)', borderRadius: '12px', padding: '16px', backgroundColor: 'rgba(0,0,0,0.1)' }}>
                      <h4 style={{ margin: '0 0 12px 0', fontSize: '0.95rem', display: 'flex', alignItems: 'center', gap: '8px' }}><CheckSquare size={16} color="var(--primary)" /> Checklist</h4>
                      
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', maxHeight: '150px', overflowY: 'auto', marginBottom: '12px' }}>
                        {editTask.checklist && editTask.checklist.length > 0 ? (
                          editTask.checklist.map((item, idx) => (
                            <div key={idx} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px' }}>
                              <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', flex: 1, fontSize: '0.85rem' }}>
                                <input type="checkbox" checked={item.completed} onChange={() => toggleChecklistItem(idx)} />
                                <span style={{ textDecoration: item.completed ? 'line-through' : 'none', color: item.completed ? 'var(--text-secondary)' : 'var(--text-primary)' }}>{item.text}</span>
                              </label>
                              <button type="button" onClick={() => deleteChecklistItem(idx)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--danger)', padding: 0 }}><X size={14} /></button>
                            </div>
                          ))
                        ) : (
                          <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>No checklist items yet.</span>
                        )}
                      </div>

                      <div style={{ display: 'flex', gap: '8px' }}>
                        <input 
                          type="text" 
                          placeholder="Add item..." 
                          value={newChecklistItem} 
                          onChange={(e) => setNewChecklistItem(e.target.value)} 
                          style={{ flex: 1, padding: '6px 12px', fontSize: '0.85rem', borderRadius: '6px', border: '1px solid var(--border-light)', backgroundColor: 'var(--bg-main)', color: 'var(--text-primary)' }}
                        />
                        <button 
                          type="button" 
                          onClick={addChecklistItem} 
                          style={{ padding: '6px 12px', fontSize: '0.85rem', borderRadius: '6px', backgroundColor: 'var(--primary)', color: '#0b0f19', fontWeight: 'bold', border: 'none' }}
                        >
                          Add
                        </button>
                      </div>
                    </div>

                    {/* Sub-Tasks */}
                    <div style={{ border: '1px solid var(--border-light)', borderRadius: '12px', padding: '16px', backgroundColor: 'rgba(0,0,0,0.1)' }}>
                      <h4 style={{ margin: '0 0 12px 0', fontSize: '0.95rem', display: 'flex', alignItems: 'center', gap: '8px' }}><CheckSquare size={16} color="var(--primary)" /> Sub-Tasks</h4>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', maxHeight: '150px', overflowY: 'auto', marginBottom: '12px' }}>
                        {(editTask.subTasks || []).length > 0 ? (
                          editTask.subTasks.map((sub, idx) => (
                            <div key={idx} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px' }}>
                              <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', flex: 1, fontSize: '0.85rem' }}>
                                <input type="checkbox" checked={sub.completed} onChange={() => toggleSubTask(idx)} />
                                <span style={{ textDecoration: sub.completed ? 'line-through' : 'none', color: sub.completed ? 'var(--text-secondary)' : 'var(--text-primary)' }}>
                                  {sub.title}
                                </span>
                                {sub.assignee && (
                                  <span style={{ fontSize: '0.75rem', padding: '2px 6px', borderRadius: '4px', backgroundColor: 'rgba(255,255,255,0.05)', color: 'var(--text-secondary)', marginLeft: '10px' }}>
                                    👤 {sub.assignee.name || sub.assignee.username}
                                  </span>
                                )}
                              </label>
                              <button type="button" onClick={() => deleteSubTask(idx)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--danger)', padding: 0 }}><X size={14} /></button>
                            </div>
                          ))
                        ) : (
                          <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>No sub-tasks yet.</span>
                        )}
                      </div>
                      <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                        <input 
                          type="text" 
                          placeholder="Sub-task title..." 
                          value={newSubTaskTitle} 
                          onChange={(e) => setNewSubTaskTitle(e.target.value)} 
                          style={{ flex: 1, minWidth: '150px', padding: '6px 12px', fontSize: '0.85rem', borderRadius: '6px', border: '1px solid var(--border-light)', backgroundColor: 'var(--bg-main)', color: 'var(--text-primary)' }} 
                        />
                        <select 
                          value={newSubTaskAssignee} 
                          onChange={(e) => setNewSubTaskAssignee(e.target.value)} 
                          style={{ padding: '6px 12px', fontSize: '0.85rem', borderRadius: '6px', border: '1px solid var(--border-light)', backgroundColor: 'var(--bg-main)', color: 'var(--text-primary)', outline: 'none' }}
                        >
                          <option value="">Assignee...</option>
                          {allUsers.map(u => (
                            <option key={u._id} value={u._id}>{u.name || u.username}</option>
                          ))}
                        </select>
                        <button 
                          type="button" 
                          onClick={addSubTask} 
                          style={{ padding: '6px 12px', fontSize: '0.85rem', borderRadius: '6px', backgroundColor: 'var(--primary)', color: '#0b0f19', fontWeight: 'bold', border: 'none', cursor: 'pointer' }}
                        >
                          Add
                        </button>
                      </div>
                    </div>

                    {/* Comments */}
                    <div style={{ border: '1px solid var(--border-light)', borderRadius: '12px', padding: '16px', backgroundColor: 'rgba(0,0,0,0.1)', display: 'flex', flexDirection: 'column', height: '240px' }}>
                      <h4 style={{ margin: '0 0 12px 0', fontSize: '0.95rem', display: 'flex', alignItems: 'center', gap: '8px' }}><MessageSquare size={16} color="var(--primary)" /> Comments</h4>
                      
                      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '10px', overflowY: 'auto', marginBottom: '12px', paddingRight: '4px' }}>
                        {editTask.comments && editTask.comments.length > 0 ? (
                          editTask.comments.map((c, idx) => (
                            <div key={idx} style={{ display: 'flex', flexDirection: 'column', gap: '2px', backgroundColor: 'var(--bg-main)', padding: '8px', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.03)' }}>
                              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                                <span style={{ fontWeight: 'bold', color: 'var(--primary)' }}>{c.sender?.name || c.sender?.username || 'User'}</span>
                                <span>{new Date(c.createdAt).toLocaleDateString()} {new Date(c.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                              </div>
                              <p style={{ margin: 0, fontSize: '0.85rem', color: 'var(--text-primary)', wordBreak: 'break-word' }}>{c.text}</p>
                            </div>
                          ))
                        ) : (
                          <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)', margin: 'auto' }}>No comments yet.</span>
                        )}
                      </div>

                      <div style={{ display: 'flex', gap: '8px' }}>
                        <input 
                          type="text" 
                          placeholder="Write a comment..." 
                          value={newCommentText} 
                          onChange={(e) => setNewCommentText(e.target.value)} 
                          style={{ flex: 1, padding: '6px 12px', fontSize: '0.85rem', borderRadius: '6px', border: '1px solid var(--border-light)', backgroundColor: 'var(--bg-main)', color: 'var(--text-primary)' }}
                        />
                        <button 
                          type="button" 
                          onClick={addComment} 
                          style={{ padding: '6px 12px', fontSize: '0.85rem', borderRadius: '6px', backgroundColor: 'var(--primary)', color: '#0b0f19', fontWeight: 'bold', border: 'none' }}
                        >
                          Send
                        </button>
                      </div>
                    </div>
                  </div>
                )}

                {taskDetailTab === 'time' && (
                  <div style={{ flex: 1, minWidth: '300px', display: 'flex', flexDirection: 'column', gap: '20px' }}>
                    <div style={{ display: 'flex', gap: '15px', flexWrap: 'wrap' }}>
                      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '15px' }}>
                        {/* Live Stopwatch */}
                        <div style={{ border: '1px solid var(--border-light)', borderRadius: '12px', padding: '16px', backgroundColor: 'rgba(0,0,0,0.1)', textAlign: 'center' }}>
                          <h4 style={{ margin: '0 0 10px 0', fontSize: '0.95rem' }}>⏱️ Live Stopwatch</h4>
                          <div style={{ fontSize: '2.5rem', fontFamily: 'monospace', fontWeight: 'bold', color: activeTimerTaskId === editTask._id ? 'var(--primary)' : 'var(--text-secondary)', margin: '15px 0' }}>
                            {(() => {
                              const displaySecs = activeTimerTaskId === editTask._id ? timerSeconds : 0;
                              const hrs = Math.floor(displaySecs / 3600).toString().padStart(2, '0');
                              const mins = Math.floor((displaySecs % 3600) / 60).toString().padStart(2, '0');
                              const secs = (displaySecs % 60).toString().padStart(2, '0');
                              return `${hrs}:${mins}:${secs}`;
                            })()}
                          </div>
                          
                          <div style={{ display: 'flex', justifyContent: 'center', gap: '12px', marginBottom: '5px' }}>
                            {activeTimerTaskId !== editTask._id ? (
                              <button 
                                type="button" 
                                onClick={() => startStopwatch(editTask._id)}
                                style={{ padding: '8px 16px', borderRadius: '6px', border: 'none', backgroundColor: '#10b981', color: 'white', fontWeight: 'bold', cursor: 'pointer' }}
                              >
                                Start Timer
                              </button>
                            ) : (
                              <button 
                                type="button" 
                                onClick={() => {
                                  const desc = prompt("Enter work description for this timer log:") || "";
                                  stopStopwatchAndLog(desc);
                                }}
                                style={{ padding: '8px 16px', borderRadius: '6px', border: 'none', backgroundColor: '#ef4444', color: 'white', fontWeight: 'bold', cursor: 'pointer' }}
                              >
                                Stop & Log Time
                              </button>
                            )}
                          </div>
                        </div>

                        {/* Manual Log */}
                        <div style={{ border: '1px solid var(--border-light)', borderRadius: '12px', padding: '16px', backgroundColor: 'rgba(0,0,0,0.1)' }}>
                          <h4 style={{ margin: '0 0 12px 0', fontSize: '0.95rem' }}>✍️ Manual Time Log</h4>
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                            <div>
                              <label style={{ display: 'block', marginBottom: '4px', fontSize: '0.8rem', color: 'var(--text-secondary)' }}>Hours worked (e.g. 1.5)</label>
                              <input type="number" step="0.1" placeholder="Hours" value={manualLogHours} onChange={e => setManualLogHours(e.target.value)} style={{ width: '100%', padding: '8px 12px', fontSize: '0.85rem', borderRadius: '6px', border: '1px solid var(--border-light)', backgroundColor: 'var(--bg-main)', color: 'var(--text-primary)' }} />
                            </div>
                            <div>
                              <label style={{ display: 'block', marginBottom: '4px', fontSize: '0.8rem', color: 'var(--text-secondary)' }}>Description</label>
                              <input type="text" placeholder="What did you do?" value={manualLogDesc} onChange={e => setManualLogDesc(e.target.value)} style={{ width: '100%', padding: '8px 12px', fontSize: '0.85rem', borderRadius: '6px', border: '1px solid var(--border-light)', backgroundColor: 'var(--bg-main)', color: 'var(--text-primary)' }} />
                            </div>
                            <button type="button" onClick={addManualTimeLog} style={{ padding: '8px 16px', borderRadius: '6px', backgroundColor: 'var(--primary)', color: '#0b0f19', fontWeight: 'bold', border: 'none', cursor: 'pointer' }}>Log Hours</button>
                          </div>
                        </div>
                      </div>

                      {/* Log List */}
                      <div style={{ flex: 1, border: '1px solid var(--border-light)', borderRadius: '12px', padding: '16px', backgroundColor: 'rgba(0,0,0,0.1)', display: 'flex', flexDirection: 'column', height: '350px' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px', borderBottom: '1px solid var(--border-light)', paddingBottom: '8px' }}>
                          <h4 style={{ margin: 0, fontSize: '0.95rem' }}>Logs Sheet</h4>
                          <strong style={{ fontSize: '0.95rem', color: 'var(--primary)' }}>
                            Total: {parseFloat((editTask.timeLogs || []).reduce((acc, curr) => acc + curr.hours, 0).toFixed(2))} hrs
                          </strong>
                        </div>
                        
                        <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                          {(editTask.timeLogs || []).length > 0 ? (
                            editTask.timeLogs.map((log, idx) => (
                              <div key={idx} style={{ backgroundColor: 'var(--bg-main)', padding: '10px', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.03)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                <div>
                                  <div style={{ fontSize: '0.8rem', fontWeight: 'bold', color: 'var(--primary)' }}>
                                    {log.user?.name || log.user?.username || 'User'}
                                  </div>
                                  <div style={{ fontSize: '0.8rem', color: 'var(--text-primary)', marginTop: '2px' }}>
                                    {log.description}
                                  </div>
                                  <div style={{ fontSize: '0.7rem', color: 'var(--text-secondary)', marginTop: '4px' }}>
                                    {new Date(log.createdAt).toLocaleDateString()}
                                  </div>
                                </div>
                                <span style={{ fontSize: '0.9rem', fontWeight: 'bold', color: 'var(--text-primary)' }}>{log.hours} hrs</span>
                              </div>
                            ))
                          ) : (
                            <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)', margin: 'auto' }}>No hours logged yet.</span>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {taskDetailTab === 'history' && (
                  <div style={{ flex: 1, minWidth: '300px', display: 'flex', flexDirection: 'column', gap: '20px' }}>
                    <div style={{ border: '1px solid var(--border-light)', borderRadius: '12px', padding: '16px', backgroundColor: 'rgba(0,0,0,0.1)', display: 'flex', flexDirection: 'column', height: '400px' }}>
                      <h4 style={{ margin: '0 0 12px 0', fontSize: '0.95rem' }}>📜 Activity & Audit History</h4>
                      <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '12px', paddingRight: '4px' }}>
                        {(editTask.activityLogs || []).length > 0 ? (
                          [...editTask.activityLogs].reverse().map((log, idx) => (
                            <div key={idx} style={{ display: 'flex', gap: '12px', position: 'relative' }}>
                              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                                <div style={{ width: '10px', height: '10px', borderRadius: '50%', backgroundColor: 'var(--primary)', boxShadow: '0 0 6px var(--primary)', marginTop: '4px' }} />
                                {idx < editTask.activityLogs.length - 1 && <div style={{ flex: 1, width: '2px', backgroundColor: 'rgba(255,255,255,0.08)', margin: '4px 0' }} />}
                              </div>
                              
                              <div style={{ backgroundColor: 'var(--bg-main)', padding: '10px', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.03)', flex: 1 }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.75rem', color: 'var(--text-secondary)', marginBottom: '4px' }}>
                                  <span style={{ fontWeight: 'bold', color: 'var(--primary)' }}>{log.action}</span>
                                  <span>{new Date(log.createdAt).toLocaleDateString()} {new Date(log.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                                </div>
                                <p style={{ margin: 0, fontSize: '0.85rem', color: 'var(--text-primary)' }}>{log.details}</p>
                                {log.user && (
                                  <span style={{ fontSize: '0.7rem', color: 'var(--text-secondary)', display: 'block', marginTop: '4px' }}>
                                    By: {log.user.name || log.user.username || 'System'}
                                  </span>
                                )}
                              </div>
                            </div>
                          ))
                        ) : (
                          <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)', margin: 'auto' }}>No activity history found.</span>
                        )}
                      </div>
                    </div>
                  </div>
                )}
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: '1px solid var(--border-light)', paddingTop: '15px', marginTop: '10px' }}>
                <button type="button" onClick={handleDeleteTask} style={{ padding: '10px 20px', borderRadius: '8px', border: '1px solid var(--danger)', backgroundColor: 'transparent', color: 'var(--danger)', cursor: 'pointer', fontWeight: 'bold' }}>Delete Task</button>
                <div style={{ display: 'flex', gap: '10px' }}>
                  <button type="button" onClick={() => setEditTask(null)} style={{ padding: '10px 20px', borderRadius: '8px', border: '1px solid var(--border-light)', backgroundColor: 'transparent', color: 'var(--text-primary)', cursor: 'pointer' }}>Cancel</button>
                  <button type="submit" style={{ padding: '10px 20px', borderRadius: '8px', border: 'none', backgroundColor: 'var(--primary)', color: '#0b0f19', cursor: 'pointer', fontWeight: 'bold' }}>Save Changes</button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Create Room Modal */}
      {showCreateRoomModal && (
        <div style={wsStyles.modalOverlay}>
          <div style={wsStyles.modalContent}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
              <h3 style={{ margin: 0 }}>Create Channel</h3>
              <button onClick={() => setShowCreateRoomModal(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-secondary)' }}><X size={20} /></button>
            </div>
            
            <form onSubmit={handleCreateRoomSubmit}>
              <div style={{ marginBottom: '20px' }}>
                <label style={{ display: 'block', marginBottom: '5px', fontSize: '0.9rem', color: 'var(--text-secondary)' }}>Channel Name</label>
                <input required autoFocus type="text" value={newRoomName} onChange={e => setNewRoomName(e.target.value)} style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid var(--border-light)', backgroundColor: 'var(--bg-main)', color: 'var(--text-primary)', outline: 'none' }} placeholder="e.g. general-discussions" />
              </div>

              <div style={{ marginBottom: '20px' }}>
                <label style={{ display: 'block', marginBottom: '10px', fontSize: '0.9rem', color: 'var(--text-secondary)' }}>Select Members to Invite</label>
                <div style={{ maxHeight: '180px', overflowY: 'auto', border: '1px solid var(--border-light)', borderRadius: '8px', padding: '10px', display: 'flex', flexDirection: 'column', gap: '8px', backgroundColor: 'var(--bg-main)' }}>
                  {otherUsers.map(u => (
                    <label key={u._id} style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontSize: '0.9rem', color: 'var(--text-primary)' }}>
                      <input type="checkbox" checked={newRoomMembers.includes(u._id)} onChange={() => handleRoomMemberToggle(u._id)} />
                      <span>{u.name || u.username} ({u.email})</span>
                    </label>
                  ))}
                </div>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
                <button type="button" onClick={() => setShowCreateRoomModal(false)} style={{ padding: '10px 20px', borderRadius: '8px', border: '1px solid var(--border-light)', backgroundColor: 'transparent', color: 'var(--text-primary)', cursor: 'pointer' }}>Cancel</button>
                <button type="submit" style={{ padding: '10px 20px', borderRadius: '8px', border: 'none', backgroundColor: 'var(--primary)', color: '#0b0f19', cursor: 'pointer', fontWeight: 'bold' }}>Create Room</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Group Settings Modal */}
      {showSettingsModal && activeRoom && (
        <div style={wsStyles.modalOverlay}>
          <div style={wsStyles.modalContent}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
              <h3 style={{ margin: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Settings size={20} /> Channel Settings
              </h3>
              <button onClick={() => setShowSettingsModal(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-secondary)' }}><X size={20} /></button>
            </div>
            
            <form onSubmit={(e) => { e.preventDefault(); saveRoomSettings(); }}>
              <div style={{ marginBottom: '15px' }}>
                <label style={{ display: 'block', marginBottom: '5px', fontSize: '0.9rem', color: 'var(--text-secondary)' }}>Channel Name</label>
                <input required type="text" value={settingsRoomName} onChange={e => setSettingsRoomName(e.target.value)} style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid var(--border-light)', backgroundColor: 'var(--bg-main)', color: 'var(--text-primary)', outline: 'none' }} />
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px', borderRadius: '8px', backgroundColor: 'rgba(255,255,255,0.02)', border: '1px solid var(--border-light)', marginBottom: '15px' }}>
                <div>
                  <div style={{ fontSize: '0.9rem', fontWeight: 'bold', color: 'var(--text-primary)' }}>Archive Channel</div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>Archived channels are hidden from the sidebar.</div>
                </div>
                <input 
                  type="checkbox" 
                  checked={settingsRoomArchived}
                  onChange={(e) => setSettingsRoomArchived(e.target.checked)}
                  style={{ width: '18px', height: '18px', cursor: 'pointer' }}
                />
              </div>

              <div style={{ marginBottom: '20px' }}>
                <label style={{ display: 'block', marginBottom: '10px', fontSize: '0.9rem', color: 'var(--text-secondary)' }}>Select Members</label>
                <div style={{ maxHeight: '180px', overflowY: 'auto', border: '1px solid var(--border-light)', borderRadius: '8px', padding: '10px', display: 'flex', flexDirection: 'column', gap: '8px', backgroundColor: 'var(--bg-main)' }}>
                  {otherUsers.map(u => {
                    const isMember = settingsRoomMembers.includes(u._id);
                    return (
                      <label key={u._id} style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontSize: '0.9rem', color: 'var(--text-primary)' }}>
                        <input type="checkbox" checked={isMember} onChange={() => handleSettingsMemberToggle(u._id)} />
                        <span>{u.name || u.username} ({u.email})</span>
                      </label>
                    );
                  })}
                </div>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
                <button type="button" onClick={() => setShowSettingsModal(false)} style={{ padding: '10px 20px', borderRadius: '8px', border: '1px solid var(--border-light)', backgroundColor: 'transparent', color: 'var(--text-primary)', cursor: 'pointer' }}>Cancel</button>
                <button type="submit" style={{ padding: '10px 20px', borderRadius: '8px', border: 'none', backgroundColor: 'var(--primary)', color: '#0b0f19', cursor: 'pointer', fontWeight: 'bold' }}>Save Changes</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Toast Notifications Overlay Container */}
      <div style={{
        position: 'fixed',
        top: '20px',
        right: '20px',
        zIndex: 10000,
        display: 'flex',
        flexDirection: 'column',
        gap: '10px',
        maxWidth: '350px',
        width: '100%'
      }}>
        {toasts.map(t => (
          <div 
            key={t.id} 
            onClick={() => { t.onClick && t.onClick(); setToasts(prev => prev.filter(x => x.id !== t.id)); }}
            style={{
              background: '#161b26',
              border: '1px solid var(--border-light, rgba(255,255,255,0.08))',
              borderLeft: '4px solid var(--primary, #38bdf8)',
              borderRadius: '8px',
              padding: '12px 16px',
              boxShadow: '0 10px 15px -3px rgba(0,0,0,0.3), 0 4px 6px -2px rgba(0,0,0,0.05)',
              cursor: t.onClick ? 'pointer' : 'default',
              display: 'flex',
              flexDirection: 'column',
              gap: '4px',
              animation: 'slideInRight 0.3s ease-out',
              color: 'var(--text-primary)'
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <strong style={{ fontSize: '0.85rem', fontWeight: 'bold' }}>{t.title}</strong>
              <button 
                onClick={(e) => { e.stopPropagation(); setToasts(prev => prev.filter(x => x.id !== t.id)); }}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted, #8892a4)', padding: 0 }}
              >
                <X size={14} />
              </button>
            </div>
            <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary, #d1d5db)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{t.body}</span>
          </div>
        ))}
      </div>

    </div>
  );
};

export default Workspace;
