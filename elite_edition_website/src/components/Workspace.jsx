import React, { useEffect, useState, useRef } from 'react';
import { useSocket } from '../contexts/SocketContext';
import { api } from '../services/api';
import { MessageSquare, Send, Users, Hash, Plus, CheckSquare, X, ImagePlus, Loader2 } from 'lucide-react';
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

  const isRoomUnread = (room) => {
    if (activeRoom && activeRoom._id === room._id) return false;
    const lastRead = lastReadTimes[room._id];
    if (!lastRead) return true; // Default to unread for new rooms/messages
    return new Date(room.updatedAt || room.createdAt) > new Date(lastRead);
  };

  // Mark room as read when activeRoom changes
  useEffect(() => {
    if (activeRoom) {
      markRoomAsRead(activeRoom._id);
    }
  }, [activeRoom]);

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

    socket.on('receive-message', handleReceiveMessage);
    socket.on('task-updated', handleTaskUpdated);
    socket.on('task-deleted', handleTaskDeleted);
    socket.on('user-typing', handleUserTyping);
    socket.on('message-reaction-updated', handleReactionUpdated);

    return () => {
      socket.off('receive-message', handleReceiveMessage);
      socket.off('task-updated', handleTaskUpdated);
      socket.off('task-deleted', handleTaskDeleted);
      socket.off('user-typing', handleUserTyping);
      socket.off('message-reaction-updated', handleReactionUpdated);
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

    socket.on('receive-message', handleReceiveMessageNotify);
    socket.on('task-updated', handleTaskUpdatedNotify);
    socket.on('room-created', handleRoomCreated);

    return () => {
      socket.off('receive-message', handleReceiveMessageNotify);
      socket.off('task-updated', handleTaskUpdatedNotify);
      socket.off('room-created', handleRoomCreated);
    };
  }, [socket, currentUser]);

  const scrollToBottom = () => {
    setTimeout(() => {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, 100);
  };

  const handleInputChange = (e) => {
    setNewMessage(e.target.value);
    
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

    socket.emit('send-message', {
      roomId: activeRoom._id,
      senderId: currentUser._id,
      content: newMessage,
      replyTo: replyToMessage ? replyToMessage._id : null
    });
    setNewMessage('');
    setReplyToMessage(null);
  };

  const handleImageUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file || !activeRoom) return;

    setIsUploading(true);
    try {
      const options = { maxSizeMB: 1, maxWidthOrHeight: 1920, useWebWorker: true };
      const compressedFile = await imageCompression(file, options);
      const uploadRes = await api.uploadChatImage(compressedFile);
      const fileUrl = uploadRes.fileUrl;

      socket.emit('send-message', {
        roomId: activeRoom._id,
        senderId: currentUser._id,
        content: fileUrl,
        replyTo: replyToMessage ? replyToMessage._id : null
      });
      setReplyToMessage(null);
      
    } catch (error) {
      console.error('Image upload failed', error);
      alert('Failed to upload image. Please make sure AWS credentials are set up.');
    } finally {
      setIsUploading(false);
      e.target.value = null;
    }
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
      dueDate: taskDueDate || undefined
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
    socket.emit('update-task-status', { taskId, newStatus });
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
      comments: editTask.comments || []
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

  const renderKanbanCard = (task) => (
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
          comments: task.comments || []
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
        transition: 'all 0.2s',
        marginBottom: '12px'
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.transform = 'translateY(-2px)';
        e.currentTarget.style.boxShadow = '0 6px 12px rgba(0,0,0,0.15)';
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.transform = 'none';
        e.currentTarget.style.boxShadow = '0 2px 5px rgba(0,0,0,0.05)';
      }}
    >
      <div style={wsStyles.taskCard.header}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <CheckSquare size={16} color="var(--primary)" />
          <strong style={{ color: 'var(--text-primary)' }}>{task.title}</strong>
        </div>
        <span style={wsStyles.taskCard.priorityBadge(task.priority)}>{task.priority}</span>
      </div>
      <div style={wsStyles.taskCard.body}>
        {renderDescription(task.description)}
        {task.dueDate && (
          <div style={{ marginTop: '10px', fontSize: '0.8rem', color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: '4px' }}>
            📅 Due: {new Date(task.dueDate).toLocaleDateString()}
          </div>
        )}
        {task.checklist && task.checklist.length > 0 && (
          <div style={{ marginTop: '10px', fontSize: '0.75rem', color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: '6px' }}>
            ☑️ {task.checklist.filter(item => item.completed).length}/{task.checklist.length} Checklist
          </div>
        )}
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

  const escapeRegExp = (string) => {
    return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  };

  const filteredTasks = boardTasks.filter(t => {
    if (taskFilter === 'my-tasks') {
      if (!t.assignees?.some(a => a._id === currentUser._id)) return false;
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
      if (!searchQuery.trim()) return text;
      const regex = new RegExp(`(${escapeRegExp(searchQuery)})`, 'gi');
      const parts = text.split(regex);
      return parts.map((part, index) => 
        regex.test(part) ? (
          <mark key={index} style={{ background: '#facc15', color: '#111827', padding: '0 2px', borderRadius: '2px' }}>{part}</mark>
        ) : (
          part
        )
      );
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
                      {isRoomUnread(room) && (
                        <div style={{
                          marginLeft: 'auto',
                          width: '8px',
                          height: '8px',
                          borderRadius: '50%',
                          backgroundColor: 'var(--danger, #ef4444)',
                          boxShadow: '0 0 6px var(--danger)'
                        }} />
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
                    return (
                      <div key={user._id} style={wsStyles.roomItem(isActive)} onClick={() => handleUserDMClick(user)}>
                        <div style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: 'var(--success)' }}></div>
                        <span>{user.name || user.username}</span>
                        {existingRoom && isRoomUnread(existingRoom) && (
                          <div style={{
                            marginLeft: 'auto',
                            width: '8px',
                            height: '8px',
                            borderRadius: '50%',
                            backgroundColor: 'var(--danger, #ef4444)',
                            boxShadow: '0 0 6px var(--danger)'
                          }} />
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* Right Area: Chat Stream */}
            <div style={wsStyles.chatArea}>
              {activeRoom ? (
                <>
                  {/* Header */}
                  <div style={wsStyles.header}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                      {activeRoom.type === 'direct' ? <Users size={24} color="var(--primary)" /> : <Hash size={24} color="var(--primary)" />}
                      <h3 style={{ margin: 0, fontSize: '1.2rem' }}>{getActiveRoomName()}</h3>
                    </div>
                    {/* Chat Search input */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px', width: '250px' }}>
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
                  </div>

                  {/* Messages */}
                  <div style={wsStyles.messageList}>
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
                                <span>{new Date(msg.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
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
                                        <strong style={{ color: 'var(--text-primary)' }}>{msg.taskId.title}</strong>
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
                                    {msg.content.startsWith('http') && (msg.content.includes('.s3.') || msg.content.includes('/uploads/')) ? (
                                      <img src={msg.content} alt="Attachment" style={{ maxWidth: '100%', borderRadius: '8px' }} />
                                    ) : (
                                      renderMessageContent(msg.content)
                                    )}

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

                    <form onSubmit={handleSendMessage} style={wsStyles.inputForm}>
                      <button 
                        type="button" 
                        onClick={() => fileInputRef.current?.click()}
                        disabled={isUploading}
                        style={{ ...wsStyles.sendBtn, backgroundColor: 'var(--bg-input, #0b0f19)', color: 'var(--text-secondary)', border: '1px solid var(--border-light)' }}
                      >
                        {isUploading ? <Loader2 size={18} className="animate-spin" /> : <ImagePlus size={18} />}
                      </button>
                      <input 
                        type="file" 
                        accept="image/*" 
                        ref={fileInputRef} 
                        style={{ display: 'none' }} 
                        onChange={handleImageUpload} 
                      />
                      <input type="text" placeholder={`Message #${activeRoom.name}...`} value={newMessage} onChange={handleInputChange} style={wsStyles.inputField} />
                      <button type="submit" style={wsStyles.sendBtn} disabled={!newMessage.trim() || isUploading}><Send size={18} /></button>
                    </form>
                  </div>
                </>
              ) : (
                <div style={{ margin: 'auto', color: 'var(--text-secondary)' }}>Select a channel to start messaging.</div>
              )}
            </div>
          </>
        )}

        {/* Task Board Tab */}
        {workspaceTab === 'tasks' && (
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '15px' }}>
              <div style={{ display: 'flex', gap: '10px', backgroundColor: 'var(--bg-card, #161b26)', padding: '4px', borderRadius: '8px', border: '1px solid var(--border-light)' }}>
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
             <div style={wsStyles.kanbanContainer}>
              {/* To Do Column */}
              <div 
                style={wsStyles.kanbanColumn}
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
                style={wsStyles.kanbanColumn}
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
                style={wsStyles.kanbanColumn}
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
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
              <h3 style={{ margin: 0 }}>Task Details</h3>
              <button onClick={() => setEditTask(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-secondary)' }}><X size={20} /></button>
            </div>
            
            <form onSubmit={handleEditTaskSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
              <div style={{ display: 'flex', gap: '24px', flexWrap: 'wrap' }}>
                {/* Left Side: Standard fields */}
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

                {/* Right Side: Checklist & Comments */}
                <div style={{ flex: 1, minWidth: '300px', display: 'flex', flexDirection: 'column', gap: '20px' }}>
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
