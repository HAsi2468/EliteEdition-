import React, { useState, useEffect, useRef } from 'react';
import { api, getBaseUrl } from '../services/api';
import { io } from 'socket.io-client';
import TaskManagerPanel from './TaskManagerPanel';
import {
  MessageSquare,
  Activity,
  Bot,
  Send,
  Users,
  Search,
  RefreshCw,
  Filter,
  Shield,
  Layers,
  CheckCircle2,
  Clock,
  ExternalLink,
  ChevronRight,
  UserCheck,
  Building2,
  Zap,
  Sparkles,
  Info,
  Paperclip,
  AlertTriangle,
  FileText,
  Image as ImageIcon,
  X,
  Maximize2,
  ThumbsUp,
  PlayCircle,
  CheckCircle,
  User,
  Plus,
  Lock,
  PlusCircle,
  Sliders,
  Trash2,
  CheckSquare
} from 'lucide-react';

export default function CommunicationPanel({ currentUser, onNavigateTab }) {
  const [groups, setGroups] = useState([]);
  const [activeGroup, setActiveGroup] = useState(null);
  const [messages, setMessages] = useState([]);
  const [inputMessage, setInputMessage] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [msgFilter, setMsgFilter] = useState('all'); // 'all' | 'human' | 'system_activity' | 'urgent' | 'media'
  const [rosterTab, setRosterTab] = useState('groups'); // 'groups' | 'direct'
  const [isUrgent, setIsUrgent] = useState(false);
  const [attachedFile, setAttachedFile] = useState(null);
  const [zoomImg, setZoomImg] = useState(null);

  // New DM modal state
  const [showNewDmModal, setShowNewDmModal] = useState(false);
  const [allUsers, setAllUsers] = useState([]);
  const [loadingUsers, setLoadingUsers] = useState(false);
  const [userSearch, setUserSearch] = useState('');

  // Group creation & member selection state
  const [showCreateGroupModal, setShowCreateGroupModal] = useState(false);
  const [newGroupName, setNewGroupName] = useState('');
  const [newGroupDept, setNewGroupDept] = useState('Production');
  const [newGroupDesc, setNewGroupDesc] = useState('');
  const [selectedMemberIds, setSelectedMemberIds] = useState([]);
  const [staffSearch, setStaffSearch] = useState('');
  const [creatingGroup, setCreatingGroup] = useState(false);

  const [loadingGroups, setLoadingGroups] = useState(true);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [syncing, setSyncing] = useState(false);

  // Group members view & edit state
  const [showMembersModal, setShowMembersModal] = useState(false);
  const [groupMembers, setGroupMembers] = useState([]);
  const [loadingMembers, setLoadingMembers] = useState(false);
  const [isEditingMembers, setIsEditingMembers] = useState(false);
  const [editMemberIds, setEditMemberIds] = useState([]);

  const socketRef = useRef(null);
  const chatBottomRef = useRef(null);
  const fileInputRef = useRef(null);

  // Ref to track activeGroup._id without triggering re-render loops / closure bugs
  const activeGroupIdRef = useRef(null);
  useEffect(() => {
    activeGroupIdRef.current = activeGroup?._id;
  }, [activeGroup?._id]);

  // Initialize Socket.io connection & fetch groups
  useEffect(() => {
    fetchGroups();

    const baseUrl = getBaseUrl().replace(/\/v1\/?$/, '');
    const socket = io(baseUrl, {
      transports: ['websocket', 'polling'],
      reconnectionAttempts: 5,
    });
    socketRef.current = socket;

    if (currentUser) {
      const uId = currentUser.id || currentUser._id;
      if (uId) {
        socket.emit('register-user', uId);
      }
    }

    socket.on('receive-message', (msg) => {
      const currentActiveId = activeGroupIdRef.current;
      if (currentActiveId && String(msg.roomId) === String(currentActiveId)) {
        setMessages((prev) => {
          if (prev.some((m) => String(m._id) === String(msg._id))) return prev;
          return [...prev, msg];
        });
      }
      fetchGroups(false);
    });

    socket.on('message-acknowledged', (data) => {
      if (data && data.messageId) {
        setMessages((prev) =>
          prev.map((m) =>
            String(m._id) === String(data.messageId)
              ? { ...m, acknowledgments: data.acknowledgments }
              : m
          )
        );
      }
    });

    socket.on('activity-notification', () => {
      fetchGroups(false);
    });

    return () => {
      socket.disconnect();
    };
  }, [currentUser]);

  // Join socket room when active group changes & fetch messages explicitly with loader
  useEffect(() => {
    if (!activeGroup) return;

    if (socketRef.current) {
      socketRef.current.emit('join-room', activeGroup._id);
    }

    fetchGroupMessages(activeGroup._id, msgFilter, true);
  }, [activeGroup?._id, msgFilter]);

  // Auto-scroll to chat bottom
  useEffect(() => {
    if (chatBottomRef.current) {
      chatBottomRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages]);

  const fetchGroups = async (showLoader = true) => {
    if (showLoader) setLoadingGroups(true);
    try {
      const uId = currentUser?._id || currentUser?.id;
      const res = await api.getCommunicationGroups(uId);
      if (res.success && res.data) {
        setGroups(res.data);
        setActiveGroup((prev) => {
          if (!prev) return res.data.length > 0 ? res.data[0] : null;
          const updated = res.data.find((g) => String(g._id) === String(prev._id));
          return updated || prev;
        });
      }
    } catch (err) {
      console.error('Failed to fetch communication groups:', err);
    } finally {
      if (showLoader) setLoadingGroups(false);
    }
  };

  const fetchGroupMessages = async (groupId, filter, showLoader = false) => {
    if (showLoader) setLoadingMessages(true);
    try {
      const params = { limit: 100 };
      if (filter === 'human' || filter === 'system_activity') {
        params.msgType = filter;
      }

      const res = await api.getCommunicationMessages(groupId, params);
      if (res.success && res.data) {
        let list = res.data;
        if (filter === 'urgent') {
          list = list.filter((m) => m.priority === 'urgent');
        } else if (filter === 'media') {
          list = list.filter((m) => m.attachment && m.attachment.fileUrl);
        }
        setMessages(list);
      }
    } catch (err) {
      console.error('Failed to fetch group messages:', err);
    } finally {
      if (showLoader) setLoadingMessages(false);
    }
  };

  const handleDeleteGroup = async (groupToDelete) => {
    if (!groupToDelete) return;
    const confirmName = groupToDelete.type === 'direct' ? 'this private DM' : `group "${groupToDelete.name}"`;
    if (!window.confirm(`Are you sure you want to delete ${confirmName}? It will be removed permanently.`)) return;

    try {
      const res = await api.deleteCommunicationGroup(groupToDelete._id);
      if (res.success) {
        const remaining = groups.filter((g) => String(g._id) !== String(groupToDelete._id));
        setGroups(remaining);
        if (activeGroup && String(activeGroup._id) === String(groupToDelete._id)) {
          setActiveGroup(remaining.length > 0 ? remaining[0] : null);
        }
      }
    } catch (err) {
      alert('Failed to delete group: ' + err.message);
    }
  };

  const handleOpenNewDmModal = async () => {
    setShowNewDmModal(true);
    setLoadingUsers(true);
    try {
      const uId = currentUser?._id || currentUser?.id;
      const res = await api.getCommunicationUsers(uId);
      if (res.success && res.data) {
        setAllUsers(res.data);
      }
    } catch (err) {
      console.error('Failed to fetch users for DM:', err);
    } finally {
      setLoadingUsers(false);
    }
  };

  const handleStartDirectChat = async (targetUser) => {
    try {
      const myId = currentUser?._id || currentUser?.id;
      const res = await api.createOrGetDirectRoom(targetUser._id, myId);
      if (res.success && res.data) {
        const dmRoom = res.data;
        setShowNewDmModal(false);
        setRosterTab('direct');
        setActiveGroup(dmRoom);
        setGroups((prev) => {
          const exists = prev.some((g) => String(g._id) === String(dmRoom._id));
          return exists ? prev : [dmRoom, ...prev];
        });
        await fetchGroups(false);
      }
    } catch (err) {
      alert('Failed to open direct message: ' + err.message);
    }
  };

  const handleOpenCreateGroupModal = async () => {
    setShowCreateGroupModal(true);
    setLoadingUsers(true);
    setStaffSearch('');
    try {
      const uId = currentUser?._id || currentUser?.id;
      const res = await api.getCommunicationUsers(uId);
      if (res.success && res.data) {
        setAllUsers(res.data);
        setSelectedMemberIds(res.data.map((u) => String(u._id)));
      }
    } catch (err) {
      console.error('Failed to fetch users for group creation:', err);
    } finally {
      setLoadingUsers(false);
    }
  };

  const toggleMemberSelection = (userId) => {
    setSelectedMemberIds((prev) =>
      prev.includes(userId) ? prev.filter((id) => id !== userId) : [...prev, userId]
    );
  };

  const handleSelectAllMembers = () => {
    setSelectedMemberIds(allUsers.map((u) => String(u._id)));
  };

  const handleDeselectAllMembers = () => {
    setSelectedMemberIds([]);
  };

  const handleCreateGroupSubmit = async (e) => {
    e.preventDefault();
    if (!newGroupName.trim()) {
      alert('Please enter a group name.');
      return;
    }

    setCreatingGroup(true);
    try {
      const myId = currentUser?.id || currentUser?._id;
      const res = await api.createCommunicationGroup({
        name: newGroupName.trim(),
        description: newGroupDesc.trim(),
        department: newGroupDept,
        memberIds: selectedMemberIds,
        userId: myId
      });

      if (res.success && res.data) {
        const newGroup = res.data;
        setShowCreateGroupModal(false);
        setNewGroupName('');
        setNewGroupDesc('');
        setSelectedMemberIds([]);
        setRosterTab('groups');
        setActiveGroup(newGroup);
        setGroups((prev) => {
          const exists = prev.some((g) => String(g._id) === String(newGroup._id));
          return exists ? prev : [newGroup, ...prev];
        });
        await fetchGroups(false);
      }
    } catch (err) {
      alert('Failed to create group: ' + err.message);
    } finally {
      setCreatingGroup(false);
    }
  };

  const handleFileUpload = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    if (file.size > 5 * 1024 * 1024) {
      alert('File size exceeds 5MB limit.');
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      setAttachedFile({
        fileName: file.name,
        fileType: file.type.startsWith('image/') ? 'image' : 'document',
        fileUrl: reader.result,
        fileSize: file.size,
      });
    };
    reader.readAsDataURL(file);
  };

  const handleSendMessage = (e) => {
    e.preventDefault();
    if ((!inputMessage.trim() && !attachedFile) || !activeGroup) return;

    const senderId = currentUser?.id || currentUser?._id;
    if (!senderId) {
      alert('User session not loaded. Please log in again.');
      return;
    }

    if (socketRef.current) {
      socketRef.current.emit('send-message', {
        roomId: activeGroup._id,
        senderId,
        content: inputMessage.trim() || (attachedFile ? `Attached ${attachedFile.fileName}` : ''),
        priority: isUrgent ? 'urgent' : 'normal',
        attachment: attachedFile || undefined,
      });
    }

    setInputMessage('');
    setAttachedFile(null);
    setIsUrgent(false);
  };

  const handleAcknowledge = async (messageId, action = 'acknowledged') => {
    const userId = currentUser?.id || currentUser?._id;
    const userName = currentUser?.name || currentUser?.username || 'User';

    try {
      const res = await api.acknowledgeCommunicationMessage(messageId, action, { userId, userName });
      if (res.success && res.data) {
        setMessages((prev) =>
          prev.map((m) =>
            String(m._id) === String(messageId)
              ? { ...m, acknowledgments: res.data.acknowledgments }
              : m
          )
        );
      }
    } catch (err) {
      console.error('Failed to acknowledge message:', err);
    }
  };

  const handleSyncGroups = async () => {
    setSyncing(true);
    try {
      const res = await api.syncCommunicationGroups();
      if (res.success) {
        alert(`Authority Groups synchronized successfully! (${res.count || 0} groups updated)`);
        await fetchGroups(true);
      }
    } catch (err) {
      alert('Failed to sync groups: ' + err.message);
    } finally {
      setSyncing(false);
    }
  };

  const handleOpenMembers = async () => {
    if (!activeGroup) return;
    setShowMembersModal(true);
    setLoadingMembers(true);
    setIsEditingMembers(false);
    try {
      const uId = currentUser?._id || currentUser?.id;
      const [membersRes, usersRes] = await Promise.all([
        api.getCommunicationMembers(activeGroup._id),
        api.getCommunicationUsers(uId)
      ]);
      if (membersRes.success && membersRes.data) {
        setGroupMembers(membersRes.data);
        setEditMemberIds(membersRes.data.map((m) => String(m._id || m)));
      }
      if (usersRes.success && usersRes.data) {
        setAllUsers(usersRes.data);
      }
    } catch (err) {
      console.error('Failed to fetch group members:', err);
    } finally {
      setLoadingMembers(false);
    }
  };

  const toggleEditMember = (userId) => {
    setEditMemberIds((prev) =>
      prev.includes(userId) ? prev.filter((id) => id !== userId) : [...prev, userId]
    );
  };

  const handleSaveMembers = async () => {
    if (!activeGroup) return;
    try {
      const res = await api.updateGroupMembers(activeGroup._id, editMemberIds);
      if (res.success && res.data) {
        setGroupMembers(res.data);
        setIsEditingMembers(false);
        alert('Group members updated successfully!');
        await fetchGroups(false);
      }
    } catch (err) {
      alert('Failed to update group members: ' + err.message);
    }
  };

  const getDMColleague = (group) => {
    if (!group || group.type !== 'direct' || !group.members || group.members.length === 0) return null;
    const myId = String(currentUser?._id || currentUser?.id || '');
    
    let otherMember = group.members.find((m) => {
      const memberId = String(typeof m === 'object' ? (m._id || m.id) : m);
      return memberId && memberId !== myId;
    });

    if (!otherMember) otherMember = group.members[0];

    // If otherMember is string ID or lacks details, attempt lookup in allUsers
    const otherId = String(typeof otherMember === 'object' ? (otherMember._id || otherMember.id) : otherMember);
    if (allUsers && allUsers.length > 0) {
      const matched = allUsers.find((u) => String(u._id || u.id) === otherId);
      if (matched) return matched;
    }

    return otherMember || null;
  };

  const handleRosterTabChange = (tab) => {
    setRosterTab(tab);
    if (tab === 'direct') {
      const dmRooms = groups.filter((g) => g.type === 'direct');
      if (dmRooms.length > 0) {
        if (!activeGroup || activeGroup.type !== 'direct') {
          setActiveGroup(dmRooms[0]);
        }
      } else {
        setActiveGroup(null);
      }
    } else if (tab === 'groups') {
      const groupRooms = groups.filter((g) => g.type !== 'direct');
      if (groupRooms.length > 0) {
        if (!activeGroup || activeGroup.type === 'direct') {
          setActiveGroup(groupRooms[0]);
        }
      }
    }
  };

  const filteredGroups = groups.filter((g) => {
    if (rosterTab === 'groups' && g.type === 'direct') return false;
    if (rosterTab === 'direct' && g.type !== 'direct') return false;

    const term = searchQuery.toLowerCase().trim();
    if (!term) return true;

    if (g.type === 'direct') {
      const colleague = getDMColleague(g);
      const cName = colleague ? (colleague.name || colleague.username || '').toLowerCase() : '';
      return cName.includes(term);
    }

    return (
      (g.name || '').toLowerCase().includes(term) ||
      (g.department || '').toLowerCase().includes(term) ||
      (g.permissionScope || '').toLowerCase().includes(term)
    );
  });

  const getDeptColor = (dept) => {
    switch ((dept || '').toLowerCase()) {
      case 'production': return '#2563eb';
      case 'fabric': return '#0284c7';
      case 'billing': return '#16a34a';
      case 'inventory': return '#0891b2';
      case 'quality': return '#dc2626';
      case 'stitching': return '#7c3aed';
      case 'finance': return '#d97706';
      case 'design': return '#db2777';
      default: return '#2563eb';
    }
  };

  const getActionBadgeStyle = (action) => {
    switch ((action || '').toUpperCase()) {
      case 'CREATE':
        return { bg: '#dcfce7', color: '#15803d', border: '#86efac' };
      case 'UPDATE':
        return { bg: '#dbeafe', color: '#1d4ed8', border: '#93c5fd' };
      case 'DELETE':
        return { bg: '#fee2e2', color: '#b91c1c', border: '#fca5a5' };
      case 'STAGE_CHANGE':
        return { bg: '#fef3c7', color: '#b45309', border: '#fde68a' };
      default:
        return { bg: '#f3f4f6', color: '#4b5563', border: '#e5e7eb' };
    }
  };

  const formatTime = (isoString) => {
    if (!isoString) return '';
    try {
      const date = new Date(isoString);
      return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    } catch (e) {
      return '';
    }
  };

  const formatDateLabel = (dtStr) => {
    if (!dtStr) return '';
    try {
      const dt = new Date(dtStr);
      return dt.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
    } catch (e) {
      return '';
    }
  };

  const handleRecordClick = (meta) => {
    if (!onNavigateTab || !meta) return;
    const scope = (meta.permissionScope || meta.module || '').toLowerCase();
    if (scope.includes('jobcard')) onNavigateTab('jobcards_list');
    else if (scope.includes('fabric')) onNavigateTab('jobcards_fabric');
    else if (scope.includes('billing')) onNavigateTab('jobcards_billing');
    else if (scope.includes('inventory')) onNavigateTab('inventory');
    else if (scope.includes('complain')) onNavigateTab('jobcards_complain');
    else if (scope.includes('stitching')) onNavigateTab('jobcards_stitching_challan');
    else if (scope.includes('expense')) onNavigateTab('jobcards_expense');
  };

  const renderContentWithMentions = (text) => {
    if (!text) return null;
    const recordRegex = /@(JC|DES|INV)-([a-zA-Z0-9_-]+)/gi;
    const parts = text.split(recordRegex);
    if (parts.length === 1) return text;

    const elements = [];
    const matches = [...text.matchAll(recordRegex)];

    let lastIndex = 0;
    matches.forEach((m, idx) => {
      const matchText = m[0];
      const matchIndex = m.index;
      if (matchIndex > lastIndex) {
        elements.push(text.substring(lastIndex, matchIndex));
      }

      const prefix = m[1].toUpperCase();

      elements.push(
        <button
          key={idx}
          onClick={() =>
            handleRecordClick({
              module: prefix === 'JC' ? 'Job Card' : prefix === 'DES' ? 'Design' : 'Invoice',
              permissionScope: prefix === 'JC' ? 'jobcards' : prefix === 'DES' ? 'catalogue' : 'billing',
            })
          }
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '3px',
            background: 'rgba(37,99,235,0.14)',
            color: '#1d4ed8',
            border: '1px solid #bfdbfe',
            borderRadius: '4px',
            padding: '1px 6px',
            fontSize: '0.78rem',
            fontWeight: 800,
            cursor: 'pointer',
            margin: '0 2px',
          }}
        >
          <ExternalLink size={11} />
          <span>{matchText}</span>
        </button>
      );

      lastIndex = matchIndex + matchText.length;
    });

    if (lastIndex < text.length) {
      elements.push(text.substring(lastIndex));
    }

    return elements;
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: 'calc(100vh - 70px)', padding: '0.75rem', gap: '0.75rem', background: 'var(--bg-main)', boxSizing: 'border-box' }}>
      
      {/* ── TOP HEADER / ACTION BAR ── */}
      <div className="glass-panel" style={{ padding: '0.65rem 1rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderRadius: '12px', background: 'var(--bg-card)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
          <div style={{ width: 36, height: 36, borderRadius: '10px', background: 'linear-gradient(135deg, #38bdf8 0%, #2563eb 100%)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', boxShadow: '0 4px 12px rgba(37,99,235,0.25)' }}>
            <MessageSquare size={20} />
          </div>
          <div>
            <h2 style={{ margin: 0, fontSize: '1.05rem', fontWeight: 800, color: 'var(--text-primary)', letterSpacing: '-0.01em' }}>
              Inter-Department Communication &amp; Activity Stream
            </h2>
            <p style={{ margin: 0, fontSize: '0.72rem', color: 'var(--text-muted)', fontWeight: 500 }}>
              Real-time department group chat, 1-on-1 private DMs &amp; SOS alerts
            </p>
          </div>
        </div>

        <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
          {currentUser?.role === 'admin' && (
            <button
              onClick={handleOpenCreateGroupModal}
              className="btn-primary"
              style={{ fontSize: '0.78rem', padding: '0.4rem 0.85rem', gap: '0.4rem', borderRadius: '8px', background: 'linear-gradient(135deg, #38bdf8 0%, #2563eb 100%)' }}
              title="Create a new custom communication group with members"
            >
              <PlusCircle size={14} />
              <span>+ Create Group</span>
            </button>
          )}

          <button
            onClick={handleSyncGroups}
            disabled={syncing}
            className="btn-secondary"
            style={{ fontSize: '0.78rem', padding: '0.4rem 0.85rem', gap: '0.4rem', borderRadius: '8px' }}
            title="Re-synchronize department access groups based on current user authorities"
          >
            <RefreshCw size={13} className={syncing ? 'spin-loader' : ''} />
            <span>{syncing ? 'Syncing...' : 'Sync Groups'}</span>
          </button>

          <button
            onClick={async () => {
              if (!window.confirm('Are you sure you want to force a hard reload for ALL connected users across the company? Connected browsers will clear caches and reload immediately.')) return;
              try {
                await api.forceReloadAllUsers();
                alert('⚡ Hard reload signal sent to all connected users!');
              } catch (err) {
                alert('Failed to send reload signal: ' + err.message);
              }
            }}
            className="btn-secondary"
            style={{ fontSize: '0.78rem', padding: '0.4rem 0.85rem', gap: '0.4rem', borderRadius: '8px', color: '#f59e0b', borderColor: '#f59e0b40' }}
            title="Force clear cache & hard reload all connected users instantly"
          >
            <Zap size={13} color="#f59e0b" />
            <span>Hard Refresh All Users</span>
          </button>
        </div>
      </div>

      {/* ── MAIN SPLIT VIEW (LEFT = ROSTER | RIGHT = CHAT / TASK STREAM) ── */}
      <div style={{ display: 'grid', gridTemplateColumns: '290px 1fr', gap: '0.75rem', flex: 1, minHeight: 0, overflow: 'hidden' }}>
        
        {/* ════ LEFT COLUMN: GROUPS & DM ROSTER ════ */}
        <div className="glass-panel" style={{ display: 'flex', flexDirection: 'column', height: '100%', borderRadius: '12px', overflow: 'hidden' }}>
          
          {/* Dual Roster Mode Switcher Pills (Groups vs Personal DMs) */}
          <div style={{ padding: '0.5rem 0.65rem', borderBottom: '1px solid var(--border-light)', background: 'var(--bg-th)', display: 'flex', gap: '4px', flexShrink: 0 }}>
            <button
              onClick={() => handleRosterTabChange('groups')}
              style={{
                flex: 1,
                padding: '0.35rem 0.45rem',
                fontSize: '0.74rem',
                fontWeight: 800,
                borderRadius: '6px',
                border: rosterTab === 'groups' ? '1px solid #2563eb' : '1px solid transparent',
                background: rosterTab === 'groups' ? '#2563eb' : 'transparent',
                color: rosterTab === 'groups' ? '#ffffff' : 'var(--text-muted)',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '4px',
                transition: 'all 0.15s ease'
              }}
            >
              <Building2 size={13} />
              <span>Groups</span>
            </button>

            <button
              onClick={() => handleRosterTabChange('direct')}
              style={{
                flex: 1,
                padding: '0.35rem 0.45rem',
                fontSize: '0.74rem',
                fontWeight: 800,
                borderRadius: '6px',
                border: rosterTab === 'direct' ? '1px solid #2563eb' : '1px solid transparent',
                background: rosterTab === 'direct' ? '#2563eb' : 'transparent',
                color: rosterTab === 'direct' ? '#ffffff' : 'var(--text-muted)',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '4px',
                transition: 'all 0.15s ease'
              }}
            >
              <User size={13} />
              <span>Personal DMs</span>
            </button>

            <button
              onClick={() => setRosterTab('tasks')}
              style={{
                flex: 1,
                padding: '0.35rem 0.45rem',
                fontSize: '0.74rem',
                fontWeight: 800,
                borderRadius: '6px',
                border: rosterTab === 'tasks' ? '1px solid #2563eb' : '1px solid transparent',
                background: rosterTab === 'tasks' ? '#2563eb' : 'transparent',
                color: rosterTab === 'tasks' ? '#ffffff' : 'var(--text-muted)',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '4px',
                transition: 'all 0.15s ease'
              }}
            >
              <CheckSquare size={13} />
              <span>TASK</span>
            </button>
          </div>

          {/* Search Bar & New DM / Group Button */}
          <div style={{ padding: '0.55rem 0.65rem', borderBottom: '1px solid var(--border-light)', display: 'flex', gap: '0.4rem', alignItems: 'center', flexShrink: 0 }}>
            <div style={{ position: 'relative', flex: 1 }}>
              <Search size={13} style={{ position: 'absolute', left: '9px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
              <input
                type="text"
                placeholder={rosterTab === 'groups' ? 'Search groups...' : 'Search contacts...'}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                style={{ width: '100%', paddingLeft: '28px', fontSize: '0.75rem', height: '30px', background: 'var(--bg-input)', border: '1px solid var(--border-light)', borderRadius: '6px', boxSizing: 'border-box' }}
              />
            </div>

            {rosterTab === 'direct' ? (
              <button
                onClick={handleOpenNewDmModal}
                className="btn-primary"
                style={{ padding: '0.35rem 0.6rem', height: '30px', fontSize: '0.72rem', borderRadius: '6px', gap: '3px' }}
                title="Start 1-on-1 private chat with a colleague"
              >
                <Plus size={13} />
                <span>New</span>
              </button>
            ) : currentUser?.role === 'admin' ? (
              <button
                onClick={handleOpenCreateGroupModal}
                className="btn-primary"
                style={{ padding: '0.35rem 0.6rem', height: '30px', fontSize: '0.72rem', borderRadius: '6px', gap: '3px' }}
                title="Create a new communication group with staff members"
              >
                <Plus size={13} />
                <span>Group</span>
              </button>
            ) : null}
          </div>

          {/* Roster Channels List */}
          <div style={{ flex: 1, overflowY: 'auto', padding: '0.4rem' }}>
            {loadingGroups ? (
              <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.85rem' }}>
                <RefreshCw size={18} className="spin-loader" style={{ marginBottom: '0.5rem' }} />
                <div>Loading conversations...</div>
              </div>
            ) : filteredGroups.length === 0 ? (
              <div style={{ padding: '1.5rem', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.78rem' }}>
                {rosterTab === 'groups' ? (
                  <div>
                    <div>No active groups found.</div>
                    {currentUser?.role === 'admin' && (
                      <button
                        onClick={handleOpenCreateGroupModal}
                        style={{ marginTop: '0.5rem', background: 'none', border: 'none', color: '#2563eb', fontSize: '0.75rem', fontWeight: 800, cursor: 'pointer' }}
                      >
                        + Create New Group
                      </button>
                    )}
                  </div>
                ) : (
                  <div>
                    <div>No direct messages yet.</div>
                    <button
                      onClick={handleOpenNewDmModal}
                      style={{ marginTop: '0.5rem', background: 'none', border: 'none', color: '#2563eb', fontSize: '0.75rem', fontWeight: 800, cursor: 'pointer' }}
                    >
                      + Start Private Chat
                    </button>
                  </div>
                )}
              </div>
            ) : (
              filteredGroups.map((group) => {
                const isActive = activeGroup && String(activeGroup._id) === String(group._id);
                const isDirect = group.type === 'direct';
                const colleague = isDirect ? getDMColleague(group) : null;
                const colleagueName = colleague ? (typeof colleague === 'object' ? (colleague.name || colleague.username || colleague.email) : group.name) : group.name;
                const displayName = isDirect ? (colleagueName || group.name || 'Private DM') : group.name;
                const deptCol = isDirect ? '#2563eb' : getDeptColor(group.department);

                return (
                  <div
                    key={group._id}
                    onClick={() => setActiveGroup(group)}
                    style={{
                      padding: '0.55rem 0.65rem',
                      borderRadius: '8px',
                      cursor: 'pointer',
                      marginBottom: '0.3rem',
                      background: isActive ? 'var(--nav-active-bg, rgba(37,99,235,0.08))' : 'transparent',
                      borderLeft: isActive ? `3.5px solid ${deptCol}` : '3.5px solid transparent',
                      border: isActive ? `1px solid var(--border-light)` : '1px solid transparent',
                      borderLeftColor: deptCol,
                      transition: 'all 0.15s ease'
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '2px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                        {isDirect ? (
                          <div style={{ width: 20, height: 20, borderRadius: '50%', background: 'linear-gradient(135deg, #38bdf8 0%, #2563eb 100%)', color: '#fff', fontSize: '0.65rem', fontWeight: 800, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                            {(displayName || 'D').charAt(0).toUpperCase()}
                          </div>
                        ) : (
                          <Building2 size={13} color={deptCol} />
                        )}
                        <span style={{ fontSize: '0.8rem', fontWeight: isActive ? 800 : 700, color: 'var(--text-primary)', lineHeight: 1.25 }}>
                          {displayName}
                        </span>
                      </div>

                      <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                        {group.unreadCount > 0 && (
                          <span style={{ background: 'var(--primary)', color: '#fff', fontSize: '0.62rem', fontWeight: 800, padding: '1px 5px', borderRadius: '10px', flexShrink: 0 }}>
                            {group.unreadCount}
                          </span>
                        )}
                        {currentUser?.role === 'admin' && (
                          <button
                            onClick={(e) => { e.stopPropagation(); handleDeleteGroup(group); }}
                            style={{ background: 'none', border: 'none', color: '#dc2626', opacity: 0.6, cursor: 'pointer', padding: '2px', display: 'flex', alignItems: 'center' }}
                            title="Delete this group"
                          >
                            <Trash2 size={12} />
                          </button>
                        )}
                      </div>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: '3px' }}>
                      <span style={{ fontSize: '0.62rem', fontWeight: 800, color: deptCol, background: `${deptCol}15`, padding: '1px 5px', borderRadius: '4px', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                        {isDirect ? 'DIRECT MESSAGE' : (group.department || 'GENERAL')}
                      </span>
                      <span style={{ fontSize: '0.66rem', color: 'var(--text-muted)', fontWeight: 500 }}>
                        {group.lastMessage ? formatTime(group.lastMessage.createdAt) : ''}
                      </span>
                    </div>

                    {group.lastMessage && (
                      <p style={{ margin: '3px 0 0', fontSize: '0.7rem', color: 'var(--text-muted)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', fontWeight: 400 }}>
                        {group.lastMessage.msgType === 'system_activity' ? '🤖 Activity Logged' : group.lastMessage.content}
                      </p>
                    )}
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* ════ RIGHT COLUMN: CHAT STREAM / TASK MANAGER / ACTIVITY FEED ════ */}
        <div className="glass-panel" style={{ display: 'flex', flexDirection: 'column', height: '100%', borderRadius: '12px', overflow: 'hidden' }}>
          
          {rosterTab === 'tasks' ? (
            <TaskManagerPanel currentUser={currentUser} onNavigateTab={onNavigateTab} />
          ) : activeGroup ? (
            <>
              {/* Group / Direct Top Header */}
              {(() => {
                const isDirect = activeGroup.type === 'direct';
                const colleague = isDirect ? getDMColleague(activeGroup) : null;
                const colleagueName = colleague ? (typeof colleague === 'object' ? (colleague.name || colleague.username || colleague.email) : activeGroup.name) : activeGroup.name;
                const displayName = isDirect ? (colleagueName || activeGroup.name || 'Private DM') : activeGroup.name;

                return (
                  <div style={{ padding: '0.65rem 1rem', borderBottom: '1px solid var(--border-light)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: 'var(--bg-th, #f8fafc)', flexShrink: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
                      {isDirect ? (
                        <div style={{ width: 34, height: 34, borderRadius: '50%', background: 'linear-gradient(135deg, #38bdf8 0%, #2563eb 100%)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontSize: '0.9rem', fontWeight: 800, boxShadow: '0 3px 10px rgba(37,99,235,0.3)' }}>
                          {(displayName || 'D').charAt(0).toUpperCase()}
                        </div>
                      ) : (
                        <div style={{ width: 34, height: 34, borderRadius: '8px', background: `${getDeptColor(activeGroup.department)}15`, border: `1.5px solid ${getDeptColor(activeGroup.department)}`, display: 'flex', alignItems: 'center', justifyContent: 'center', color: getDeptColor(activeGroup.department) }}>
                          <Building2 size={18} />
                        </div>
                      )}

                      <div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem' }}>
                          <h3 style={{ margin: 0, fontSize: '0.95rem', fontWeight: 800, color: 'var(--text-primary)' }}>
                            {displayName}
                          </h3>
                          <span style={{ fontSize: '0.62rem', fontWeight: 800, color: isDirect ? '#2563eb' : getDeptColor(activeGroup.department), background: isDirect ? '#eff6ff' : `${getDeptColor(activeGroup.department)}18`, padding: '1px 6px', borderRadius: '4px', textTransform: 'uppercase' }}>
                            {isDirect ? '1-on-1 PRIVATE DM' : activeGroup.department}
                          </span>
                        </div>
                        <p style={{ margin: 0, fontSize: '0.7rem', color: 'var(--text-muted)', fontWeight: 500, marginTop: '1px' }}>
                          {isDirect ? (
                            <span>Role: <strong>{colleague?.role || 'Staff'}</strong> · Private Direct Conversation</span>
                          ) : (
                            <span>{activeGroup.description || `Department: ${activeGroup.department || 'General'}`}</span>
                          )}
                        </p>
                      </div>
                    </div>

                    {/* Filter Tabs, Delete & Members Buttons */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                      {/* Msg Filter Pill */}
                      <div style={{ display: 'flex', background: 'var(--bg-main)', padding: '2px', borderRadius: '6px', border: '1px solid var(--border-light)' }}>
                        {[
                          { id: 'all', label: 'All' },
                          { id: 'human', label: '💬 Chat' },
                          { id: 'system_activity', label: '🤖 Activity' },
                          { id: 'urgent', label: '🚨 SOS' },
                          { id: 'media', label: '📎 Media' },
                        ].map((f) => (
                          <button
                            key={f.id}
                            onClick={() => setMsgFilter(f.id)}
                            style={{
                              background: msgFilter === f.id ? 'var(--primary)' : 'transparent',
                              color: msgFilter === f.id ? '#fff' : 'var(--text-muted)',
                              border: 'none',
                              fontSize: '0.7rem',
                              fontWeight: 700,
                              padding: '0.25rem 0.5rem',
                              borderRadius: '4px',
                              cursor: 'pointer',
                              transition: 'all 0.15s'
                            }}
                          >
                            {f.label}
                          </button>
                        ))}
                      </div>

                      {!isDirect && (
                        <button
                          onClick={handleOpenMembers}
                          className="btn-secondary"
                          style={{ fontSize: '0.75rem', padding: '0.35rem 0.65rem', gap: '0.35rem', borderRadius: '6px' }}
                          title="View authorized members of this group"
                        >
                          <Users size={13} />
                          <span>Members ({activeGroup.members?.length || 0})</span>
                        </button>
                      )}

                      {currentUser?.role === 'admin' && (
                        <button
                          onClick={() => handleDeleteGroup(activeGroup)}
                          className="btn-secondary"
                          style={{ fontSize: '0.75rem', padding: '0.35rem 0.65rem', gap: '0.35rem', borderRadius: '6px', color: '#dc2626', border: '1px solid #fca5a5', background: '#fee2e2' }}
                          title="Delete this group permanently"
                        >
                          <Trash2 size={13} />
                          <span>Delete</span>
                        </button>
                      )}
                    </div>
                  </div>
                );
              })()}

              {/* Messages & Activity Stream Container */}
              <div style={{ flex: 1, overflowY: 'auto', padding: '1rem', display: 'flex', flexDirection: 'column', gap: '0.75rem', background: 'var(--bg-main)' }}>
                {loadingMessages ? (
                  <div style={{ margin: 'auto', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.85rem' }}>
                    <RefreshCw size={20} className="spin-loader" style={{ marginBottom: '0.5rem' }} />
                    <div>Loading stream history...</div>
                  </div>
                ) : messages.length === 0 ? (
                  <div style={{ margin: 'auto', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.85rem' }}>
                    <MessageSquare size={32} style={{ marginBottom: '0.5rem', opacity: 0.4 }} />
                    <div>No messages in this stream yet. Start the conversation below!</div>
                  </div>
                ) : (
                  messages.map((msg) => {
                    const isMe = String(msg.senderId?._id || msg.senderId) === String(currentUser?.id || currentUser?._id);
                    const isSystemActivity = msg.msgType === 'system_activity';

                    if (isSystemActivity) {
                      const actBadge = getActionBadgeStyle(msg.actionType);
                      return (
                        <div
                          key={msg._id}
                          style={{
                            alignSelf: 'center',
                            width: '100%',
                            maxWidth: '720px',
                            background: 'var(--bg-card)',
                            border: `1px solid ${actBadge.border}`,
                            borderLeft: `4px solid ${actBadge.color}`,
                            borderRadius: '10px',
                            padding: '0.75rem 1rem',
                            boxShadow: '0 2px 6px rgba(0,0,0,0.04)',
                            margin: '0.2rem 0'
                          }}
                        >
                          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.4rem' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                              <span style={{ fontSize: '0.65rem', fontWeight: 800, padding: '2px 6px', borderRadius: '4px', background: actBadge.bg, color: actBadge.color, border: `1px solid ${actBadge.border}` }}>
                                {msg.actionType || 'ACTIVITY'}
                              </span>
                              <span style={{ fontSize: '0.75rem', fontWeight: 800, color: 'var(--text-primary)' }}>
                                {msg.moduleName} — {msg.screenName}
                              </span>
                            </div>
                            <span style={{ fontSize: '0.68rem', color: 'var(--text-muted)' }}>
                              {formatTime(msg.createdAt)}
                            </span>
                          </div>

                          <div style={{ fontSize: '0.82rem', color: 'var(--text-primary)', lineHeight: 1.4, marginBottom: '0.4rem' }}>
                            {msg.content}
                          </div>

                          {msg.recordReference && (
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.72rem', color: '#2563eb', fontWeight: 700 }}>
                              <ExternalLink size={12} />
                              <span>Ref: {msg.recordReference.recordCode || msg.recordReference.recordId}</span>
                            </div>
                          )}

                          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: '0.5rem', paddingTop: '0.4rem', borderTop: '1px solid var(--border-light)' }}>
                            <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>
                              Actor: <strong>{msg.senderName || msg.senderId?.name || 'System Bot'}</strong>
                            </span>

                            <div style={{ display: 'flex', gap: '0.4rem' }}>
                              {(msg.acknowledgments || []).some((a) => String(a.user) === String(currentUser?.id || currentUser?._id)) ? (
                                <span style={{ fontSize: '0.7rem', color: '#16a34a', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '3px' }}>
                                  <CheckCircle size={13} /> Acknowledged
                                </span>
                              ) : (
                                <button
                                  onClick={() => handleAcknowledge(msg._id, 'acknowledged')}
                                  style={{ background: 'rgba(37,99,235,0.08)', border: '1px solid rgba(37,99,235,0.2)', color: '#2563eb', fontSize: '0.7rem', fontWeight: 700, padding: '2px 8px', borderRadius: '4px', cursor: 'pointer' }}
                                >
                                  Acknowledge
                                </button>
                              )}
                            </div>
                          </div>
                        </div>
                      );
                    }

                    return (
                      <div
                        key={msg._id}
                        style={{
                          alignSelf: isMe ? 'flex-end' : 'flex-start',
                          maxWidth: '70%',
                          display: 'flex',
                          flexDirection: 'column',
                          alignItems: isMe ? 'flex-end' : 'flex-start'
                        }}
                      >
                        <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)', marginBottom: '2px', fontWeight: 600 }}>
                          {msg.senderId?.name || msg.senderName || 'Staff Member'} · {formatTime(msg.createdAt)}
                        </div>

                        <div
                          style={{
                            background: isMe ? 'linear-gradient(135deg, #38bdf8 0%, #2563eb 100%)' : 'var(--bg-card)',
                            color: isMe ? '#ffffff' : 'var(--text-primary)',
                            padding: '0.65rem 0.9rem',
                            borderRadius: isMe ? '14px 14px 2px 14px' : '14px 14px 14px 2px',
                            border: isMe ? 'none' : '1px solid var(--border-light)',
                            boxShadow: '0 2px 8px rgba(0,0,0,0.04)',
                            fontSize: '0.85rem',
                            lineHeight: 1.45,
                            wordBreak: 'break-word'
                          }}
                        >
                          {msg.attachment && msg.attachment.fileUrl && (
                            <div style={{ marginBottom: '0.5rem' }}>
                              {msg.attachment.fileType === 'image' ? (
                                <img
                                  src={msg.attachment.fileUrl}
                                  alt="Attachment"
                                  onClick={() => setZoomImg(msg.attachment.fileUrl)}
                                  style={{ maxWidth: '100%', maxHeight: '220px', borderRadius: '8px', cursor: 'zoom-in', objectFit: 'cover' }}
                                />
                              ) : (
                                <a
                                  href={msg.attachment.fileUrl}
                                  download={msg.attachment.fileName}
                                  style={{ color: isMe ? '#fff' : '#2563eb', fontWeight: 700, fontSize: '0.78rem', display: 'flex', alignItems: 'center', gap: '4px', textDecoration: 'underline' }}
                                >
                                  <FileText size={14} /> {msg.attachment.fileName}
                                </a>
                              )}
                            </div>
                          )}

                          {msg.content}
                        </div>
                      </div>
                    );
                  })
                )}
                <div ref={chatBottomRef} />
              </div>

              {/* Attachment Preview Banner */}
              {attachedFile && (
                <div style={{ padding: '0.4rem 0.9rem', background: '#eff6ff', borderTop: '1px solid #bfdbfe', display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: '0.75rem', fontWeight: 700, color: '#1d4ed8' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                    <Paperclip size={14} color="#2563eb" />
                    <span>Attached: {attachedFile.fileName}</span>
                  </div>
                  <button onClick={() => setAttachedFile(null)} style={{ background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer' }}>
                    <X size={14} />
                  </button>
                </div>
              )}

              {/* Hidden File Input */}
              <input type="file" ref={fileInputRef} onChange={handleFileUpload} style={{ display: 'none' }} accept="image/*,.pdf,.doc,.docx" />

              {/* Chat Input Form */}
              <form onSubmit={handleSendMessage} style={{ padding: '0.65rem 0.9rem', background: 'var(--bg-card)', borderTop: '1px solid var(--border-light)', display: 'flex', gap: '0.5rem', alignItems: 'center', flexShrink: 0 }}>
                {/* Paperclip Button */}
                <button
                  type="button"
                  onClick={() => fileInputRef.current && fileInputRef.current.click()}
                  style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', padding: '0.3rem', display: 'flex', alignItems: 'center' }}
                  title="Attach photo or document"
                >
                  <Paperclip size={18} />
                </button>

                {/* Urgent SOS Toggle */}
                <button
                  type="button"
                  onClick={() => setIsUrgent(!isUrgent)}
                  style={{
                    background: isUrgent ? '#ef4444' : 'transparent',
                    color: isUrgent ? '#ffffff' : '#dc2626',
                    border: '1px solid #fca5a5',
                    borderRadius: '6px',
                    padding: '0.3rem 0.6rem',
                    fontSize: '0.72rem',
                    fontWeight: 800,
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '4px',
                    boxShadow: isUrgent ? '0 0 10px rgba(239,68,68,0.4)' : 'none',
                    transition: 'all 0.15s ease'
                  }}
                  title="Toggle Urgent SOS High Priority Alert"
                >
                  <AlertTriangle size={13} />
                  <span>{isUrgent ? 'SOS ON' : 'SOS'}</span>
                </button>

                <input
                  type="text"
                  placeholder={`Type message or mention @JC-1004...`}
                  value={inputMessage}
                  onChange={(e) => setInputMessage(e.target.value)}
                  style={{ flex: 1, padding: '0.55rem 0.85rem', fontSize: '0.85rem', background: 'var(--bg-input)', border: '1px solid var(--border-light)', borderRadius: '8px', color: 'var(--text-primary)', outline: 'none' }}
                />

                <button
                  type="submit"
                  disabled={!inputMessage.trim() && !attachedFile}
                  className="btn-primary"
                  style={{ padding: '0.55rem 1.1rem', fontSize: '0.82rem', height: '36px', gap: '0.35rem', borderRadius: '8px', opacity: (!inputMessage.trim() && !attachedFile) ? 0.6 : 1 }}
                >
                  <Send size={14} />
                  <span>Send</span>
                </button>
              </form>
            </>
          ) : (
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)', padding: '2rem', textAlign: 'center' }}>
              <div style={{ width: 54, height: 54, borderRadius: '50%', background: 'rgba(37,99,235,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#2563eb', marginBottom: '1rem' }}>
                <User size={28} />
              </div>
              <h3 style={{ margin: '0 0 0.4rem', fontSize: '1rem', fontWeight: 800, color: 'var(--text-primary)' }}>
                {rosterTab === 'direct' ? 'Personal 1-on-1 Messages' : 'Communication Stream'}
              </h3>
              <p style={{ margin: '0 0 1.2rem', fontSize: '0.8rem', color: 'var(--text-muted)', maxWidth: 360, lineHeight: 1.4 }}>
                {rosterTab === 'direct'
                  ? "You don't have any active direct conversations selected yet. Click below to start a private chat with a staff member."
                  : 'Select a group from the left side panel to view messages.'}
              </p>
              {rosterTab === 'direct' && (
                <button
                  onClick={handleOpenNewDmModal}
                  className="btn-primary"
                  style={{ fontSize: '0.82rem', padding: '0.5rem 1.2rem', gap: '0.4rem', borderRadius: '8px' }}
                >
                  <Plus size={16} />
                  <span>+ Start Private Chat</span>
                </button>
              )}
            </div>
          )}
        </div>
      </div>

      {/* ── CREATE GROUP & SELECT MEMBERS MODAL ── */}
      {showCreateGroupModal && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 9999, background: 'rgba(15, 23, 42, 0.65)', backdropFilter: 'blur(5px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem' }}>
          <div className="glass-panel" style={{ width: '100%', maxWidth: 580, maxHeight: '90vh', borderRadius: '16px', overflow: 'hidden', display: 'flex', flexDirection: 'column', animation: 'slideUp 0.2s ease-out', boxShadow: '0 20px 40px rgba(0,0,0,0.3)' }}>
            
            {/* Modal Header */}
            <div style={{ padding: '1.1rem 1.4rem', borderBottom: '1px solid var(--border-light)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'linear-gradient(135deg, #0f172a 0%, #1e293b 100%)', color: '#fff' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                <div style={{ width: 36, height: 36, borderRadius: '10px', background: 'linear-gradient(135deg, #38bdf8 0%, #2563eb 100%)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff' }}>
                  <Users size={20} />
                </div>
                <div>
                  <h3 style={{ margin: 0, fontSize: '1.05rem', fontWeight: 800, letterSpacing: '-0.01em', color: '#fff' }}>
                    Create New Group & Assign Members
                  </h3>
                  <p style={{ margin: 0, fontSize: '0.72rem', color: '#94a3b8', fontWeight: 500 }}>
                    Enter group details and select staff members to include in this group
                  </p>
                </div>
              </div>

              <button
                onClick={() => setShowCreateGroupModal(false)}
                style={{ background: 'rgba(255,255,255,0.1)', border: 'none', color: '#fff', width: 28, height: 28, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}
              >
                <X size={16} />
              </button>
            </div>

            {/* Modal Form */}
            <form onSubmit={handleCreateGroupSubmit} style={{ padding: '1.2rem 1.4rem', overflowY: 'auto', flex: 1, display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              
              {/* Group Name & Department */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.85rem' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.76rem', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '4px' }}>
                    Group Name *
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. Stitching & Production Team"
                    value={newGroupName}
                    onChange={(e) => setNewGroupName(e.target.value)}
                    style={{ width: '100%', padding: '0.55rem 0.8rem', fontSize: '0.82rem', borderRadius: '8px', border: '1px solid var(--border-light)', background: 'var(--bg-input)', color: 'var(--text-primary)', boxSizing: 'border-box' }}
                    required
                  />
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '0.76rem', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '4px' }}>
                    Department Category
                  </label>
                  <select
                    value={newGroupDept}
                    onChange={(e) => setNewGroupDept(e.target.value)}
                    style={{ width: '100%', padding: '0.55rem 0.8rem', fontSize: '0.82rem', borderRadius: '8px', border: '1px solid var(--border-light)', background: 'var(--bg-input)', color: 'var(--text-primary)' }}
                  >
                    <option value="Production">Production</option>
                    <option value="Stitching">Stitching</option>
                    <option value="Billing">Billing</option>
                    <option value="Fabric">Fabric</option>
                    <option value="E-Commerce">E-Commerce</option>
                    <option value="Design">Design</option>
                    <option value="Inventory">Inventory</option>
                    <option value="Quality">Quality</option>
                    <option value="Finance">Finance</option>
                    <option value="General">General</option>
                  </select>
                </div>
              </div>

              {/* Group Description */}
              <div>
                <label style={{ display: 'block', fontSize: '0.76rem', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '4px' }}>
                  Group Description (Optional)
                </label>
                <input
                  type="text"
                  placeholder="e.g. Group for garment production tracking and team coordination"
                  value={newGroupDesc}
                  onChange={(e) => setNewGroupDesc(e.target.value)}
                  style={{ width: '100%', padding: '0.55rem 0.8rem', fontSize: '0.82rem', borderRadius: '8px', border: '1px solid var(--border-light)', background: 'var(--bg-input)', color: 'var(--text-primary)', boxSizing: 'border-box' }}
                />
              </div>

              {/* Staff Member Selection Section */}
              <div style={{ background: 'var(--bg-main)', padding: '0.9rem', borderRadius: '10px', border: '1px solid var(--border-light)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.6rem' }}>
                  <div>
                    <h4 style={{ margin: 0, fontSize: '0.82rem', fontWeight: 800, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <Users size={14} color="var(--primary)" />
                      <span>Select Group Members ({selectedMemberIds.length} / {allUsers.length})</span>
                    </h4>
                  </div>

                  <div style={{ display: 'flex', gap: '0.4rem' }}>
                    <button
                      type="button"
                      onClick={handleSelectAllMembers}
                      style={{ background: 'none', border: 'none', color: '#2563eb', fontSize: '0.72rem', fontWeight: 700, cursor: 'pointer' }}
                    >
                      Select All
                    </button>
                    <span style={{ color: 'var(--text-muted)', fontSize: '0.7rem' }}>·</span>
                    <button
                      type="button"
                      onClick={handleDeselectAllMembers}
                      style={{ background: 'none', border: 'none', color: '#ef4444', fontSize: '0.72rem', fontWeight: 700, cursor: 'pointer' }}
                    >
                      Deselect All
                    </button>
                  </div>
                </div>

                {/* Staff Search */}
                <div style={{ position: 'relative', marginBottom: '0.6rem' }}>
                  <Search size={13} style={{ position: 'absolute', left: '9px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
                  <input
                    type="text"
                    placeholder="Filter staff by name or department..."
                    value={staffSearch}
                    onChange={(e) => setStaffSearch(e.target.value)}
                    style={{ width: '100%', paddingLeft: '28px', fontSize: '0.78rem', height: '32px', background: 'var(--bg-card)', border: '1px solid var(--border-light)', borderRadius: '6px', boxSizing: 'border-box' }}
                  />
                </div>

                {/* Staff Checkboxes List */}
                <div style={{ maxHeight: '220px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
                  {loadingUsers ? (
                    <div style={{ textAlign: 'center', padding: '1rem', color: 'var(--text-muted)', fontSize: '0.78rem' }}>
                      <RefreshCw size={16} className="spin-loader" />
                      <div>Loading staff list...</div>
                    </div>
                  ) : (
                    allUsers
                      .filter((u) => {
                        const term = staffSearch.toLowerCase().trim();
                        if (!term) return true;
                        return (
                          (u.name || '').toLowerCase().includes(term) ||
                          (u.username || '').toLowerCase().includes(term) ||
                          (u.email || '').toLowerCase().includes(term) ||
                          (u.department || '').toLowerCase().includes(term)
                        );
                      })
                      .map((u) => {
                        const isChecked = selectedMemberIds.includes(String(u._id));
                        return (
                          <div
                            key={u._id}
                            onClick={() => toggleMemberSelection(String(u._id))}
                            style={{
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'space-between',
                              padding: '0.45rem 0.65rem',
                              borderRadius: '6px',
                              background: isChecked ? 'rgba(37, 99, 235, 0.08)' : 'var(--bg-card)',
                              border: isChecked ? '1px solid #2563eb' : '1px solid var(--border-light)',
                              cursor: 'pointer',
                              transition: 'all 0.15s ease'
                            }}
                          >
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                              <input
                                type="checkbox"
                                checked={isChecked}
                                onChange={() => {}}
                                style={{ cursor: 'pointer' }}
                              />
                              <div style={{ width: 26, height: 26, borderRadius: '50%', background: 'linear-gradient(135deg, #38bdf8 0%, #2563eb 100%)', color: '#fff', fontSize: '0.72rem', fontWeight: 800, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                {(u.name || u.username || 'U').charAt(0).toUpperCase()}
                              </div>
                              <div>
                                <div style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--text-primary)' }}>{u.name || u.username}</div>
                                <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)' }}>{u.email}</div>
                              </div>
                            </div>

                            <span style={{ fontSize: '0.65rem', fontWeight: 700, color: 'var(--text-muted)', background: 'var(--bg-main)', padding: '1px 6px', borderRadius: '4px' }}>
                              {u.department || 'General'}
                            </span>
                          </div>
                        );
                      })
                  )}
                </div>
              </div>

              {/* Submit Buttons */}
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.6rem', marginTop: '0.4rem' }}>
                <button
                  type="button"
                  onClick={() => setShowCreateGroupModal(false)}
                  className="btn-secondary"
                  style={{ fontSize: '0.82rem', padding: '0.45rem 0.95rem', borderRadius: '8px' }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={creatingGroup}
                  className="btn-primary"
                  style={{ fontSize: '0.82rem', padding: '0.45rem 1.2rem', borderRadius: '8px', background: 'linear-gradient(135deg, #38bdf8 0%, #2563eb 100%)' }}
                >
                  {creatingGroup ? 'Creating Group...' : 'Create Group'}
                </button>
              </div>
            </form>

          </div>
        </div>
      )}

      {/* ── NEW PRIVATE DM MODAL ── */}
      {showNewDmModal && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 9999, background: 'rgba(15, 23, 42, 0.6)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem' }}>
          <div className="glass-panel" style={{ width: '100%', maxWidth: 460, borderRadius: '14px', overflow: 'hidden', animation: 'slideUp 0.2s ease-out' }}>
            <div style={{ padding: '1rem 1.2rem', borderBottom: '1px solid var(--border-light)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'var(--bg-th)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <User size={18} color="var(--primary)" />
                <h3 style={{ margin: 0, fontSize: '0.95rem', fontWeight: 800, color: 'var(--text-primary)' }}>
                  Start 1-on-1 Private Chat
                </h3>
              </div>
              <button onClick={() => setShowNewDmModal(false)} className="btn-secondary" style={{ padding: '0.2rem 0.5rem', fontSize: '0.75rem', borderRadius: '6px' }}>
                Cancel
              </button>
            </div>

            <div style={{ padding: '0.75rem 1rem' }}>
              <div style={{ position: 'relative', marginBottom: '0.75rem' }}>
                <Search size={14} style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
                <input
                  type="text"
                  placeholder="Search staff by name, email, or department..."
                  value={userSearch}
                  onChange={(e) => setUserSearch(e.target.value)}
                  style={{ width: '100%', paddingLeft: '32px', fontSize: '0.82rem', height: '36px', background: 'var(--bg-input)', border: '1px solid var(--border-light)', borderRadius: '8px', boxSizing: 'border-box' }}
                />
              </div>

              <div style={{ maxHeight: '50vh', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                {loadingUsers ? (
                  <div style={{ textAlign: 'center', padding: '1.5rem', color: 'var(--text-muted)' }}>
                    <RefreshCw size={18} className="spin-loader" />
                    <div style={{ fontSize: '0.8rem', marginTop: '0.4rem' }}>Loading staff members...</div>
                  </div>
                ) : (
                  allUsers
                    .filter((u) => {
                      const myId = String(currentUser?._id || currentUser?.id || '');
                      const uId = String(u._id || u.id || '');
                      if (myId && uId === myId) return false;

                      const term = userSearch.toLowerCase().trim();
                      if (!term) return true;
                      return (
                        (u.name || '').toLowerCase().includes(term) ||
                        (u.username || '').toLowerCase().includes(term) ||
                        (u.email || '').toLowerCase().includes(term) ||
                        (u.department || '').toLowerCase().includes(term)
                      );
                    })
                    .map((u) => (
                      <div
                        key={u._id}
                        onClick={() => handleStartDirectChat(u)}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          padding: '0.6rem 0.85rem',
                          borderRadius: '8px',
                          background: 'var(--bg-card)',
                          border: '1px solid var(--border-light)',
                          cursor: 'pointer',
                          transition: 'all 0.15s ease'
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                          <div style={{ width: 32, height: 32, borderRadius: '50%', background: 'linear-gradient(135deg, #38bdf8 0%, #2563eb 100%)', color: '#fff', fontSize: '0.85rem', fontWeight: 800, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                            {(u.name || u.username || 'U').charAt(0).toUpperCase()}
                          </div>
                          <div>
                            <div style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--text-primary)' }}>{u.name || u.username}</div>
                            <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>{u.email} · {u.department || 'General'}</div>
                          </div>
                        </div>
                        <span style={{ fontSize: '0.7rem', fontWeight: 800, color: '#2563eb', background: '#eff6ff', padding: '2px 8px', borderRadius: '6px' }}>
                          Chat →
                        </span>
                      </div>
                    ))
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── MEMBERS AUTHORITIES MODAL ── */}
      {showMembersModal && activeGroup && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 9999, background: 'rgba(15, 23, 42, 0.6)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem' }}>
          <div className="glass-panel" style={{ width: '100%', maxWidth: 540, borderRadius: '14px', overflow: 'hidden', animation: 'slideUp 0.2s ease-out' }}>
            <div style={{ padding: '1rem 1.2rem', borderBottom: '1px solid var(--border-light)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'var(--bg-th)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <Users size={18} color="var(--primary)" />
                <h3 style={{ margin: 0, fontSize: '0.95rem', fontWeight: 800, color: 'var(--text-primary)' }}>
                  Members — {activeGroup.name}
                </h3>
              </div>
              
              <div style={{ display: 'flex', gap: '0.4rem' }}>
                {currentUser?.role === 'admin' && (
                  <button
                    onClick={() => setIsEditingMembers(!isEditingMembers)}
                    className="btn-secondary"
                    style={{ padding: '0.25rem 0.6rem', fontSize: '0.74rem', borderRadius: '6px', color: '#2563eb', borderColor: '#2563eb40' }}
                  >
                    {isEditingMembers ? 'View Members' : 'Edit Members'}
                  </button>
                )}
                <button onClick={() => setShowMembersModal(false)} className="btn-secondary" style={{ padding: '0.25rem 0.5rem', fontSize: '0.74rem', borderRadius: '6px' }}>
                  Close
                </button>
              </div>
            </div>

            <div style={{ padding: '1rem', maxHeight: '60vh', overflowY: 'auto' }}>
              {loadingMembers ? (
                <div style={{ textAlign: 'center', padding: '1.5rem', color: 'var(--text-muted)' }}>
                  <RefreshCw size={18} className="spin-loader" />
                  <div style={{ fontSize: '0.8rem', marginTop: '0.4rem' }}>Loading group members...</div>
                </div>
              ) : isEditingMembers ? (
                <div>
                  <div style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '0.6rem' }}>
                    Select / Unselect staff members to update group membership ({editMemberIds.length} selected):
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem', maxHeight: '240px', overflowY: 'auto' }}>
                    {allUsers.map((u) => {
                      const isChecked = editMemberIds.includes(String(u._id));
                      return (
                        <div
                          key={u._id}
                          onClick={() => toggleEditMember(String(u._id))}
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            padding: '0.45rem 0.65rem',
                            borderRadius: '6px',
                            background: isChecked ? 'rgba(37, 99, 235, 0.08)' : 'var(--bg-main)',
                            border: isChecked ? '1px solid #2563eb' : '1px solid var(--border-light)',
                            cursor: 'pointer'
                          }}
                        >
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                            <input type="checkbox" checked={isChecked} onChange={() => {}} style={{ cursor: 'pointer' }} />
                            <div style={{ fontSize: '0.8rem', fontWeight: 700 }}>{u.name || u.username}</div>
                          </div>
                          <span style={{ fontSize: '0.68rem', color: 'var(--text-muted)' }}>{u.email}</span>
                        </div>
                      );
                    })}
                  </div>
                  <button
                    onClick={handleSaveMembers}
                    className="btn-primary"
                    style={{ marginTop: '0.8rem', width: '100%', padding: '0.5rem', fontSize: '0.8rem', borderRadius: '6px' }}
                  >
                    Save Group Members
                  </button>
                </div>
              ) : groupMembers.length === 0 ? (
                <div style={{ textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.8rem', padding: '1rem' }}>
                  No members assigned yet. Click "Edit Members" to add staff members to this group.
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                  {groupMembers.map((m) => (
                    <div key={m._id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0.5rem 0.75rem', borderRadius: '8px', background: 'var(--bg-main)', border: '1px solid var(--border-light)' }}>
                      <div>
                        <div style={{ fontSize: '0.82rem', fontWeight: 700, color: 'var(--text-primary)' }}>{m.name}</div>
                        <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>{m.email}</div>
                      </div>
                      <span style={{ fontSize: '0.65rem', fontWeight: 800, textTransform: 'uppercase', padding: '2px 8px', borderRadius: '10px', background: m.role === 'admin' ? 'rgba(37,99,235,0.12)' : 'rgba(100,116,139,0.12)', color: m.role === 'admin' ? 'var(--primary)' : 'var(--text-muted)' }}>
                        {m.role || 'user'}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ── IMAGE LIGHTBOX MODAL ── */}
      {zoomImg && (
        <div onClick={() => setZoomImg(null)} style={{ position: 'fixed', inset: 0, zIndex: 99999, background: 'rgba(0,0,0,0.85)', backdropFilter: 'blur(5px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem', cursor: 'zoom-out' }}>
          <div style={{ position: 'relative', maxWidth: '90vw', maxHeight: '90vh' }}>
            <img src={zoomImg} alt="Enlarged preview" style={{ maxWidth: '100%', maxHeight: '90vh', borderRadius: '8px', boxShadow: '0 8px 30px rgba(0,0,0,0.5)' }} />
            <button onClick={() => setZoomImg(null)} style={{ position: 'absolute', top: -12, right: -12, background: '#ef4444', color: '#fff', border: 'none', borderRadius: '50%', width: 28, height: 28, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
              <X size={16} />
            </button>
          </div>
        </div>
      )}

    </div>
  );
}
