import React, { useState, useEffect, useRef } from 'react';
import { api, getBaseUrl } from '../services/api';
import { io } from 'socket.io-client';
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
  Trash2
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

  // Detailed Admin Custom Group Creator Modal State
  const [showCreateGroupModal, setShowCreateGroupModal] = useState(false);
  const [newGroupName, setNewGroupName] = useState('');
  const [newGroupDesc, setNewGroupDesc] = useState('');
  const [newGroupDept, setNewGroupDept] = useState('Production');
  const [newGroupScope, setNewGroupScope] = useState('jobcards_list');
  const [selectedModules, setSelectedModules] = useState(['Job Card']);
  const [selectedActions, setSelectedActions] = useState(['CREATE', 'UPDATE', 'DELETE', 'STAGE_CHANGE']);
  const [creatingGroup, setCreatingGroup] = useState(false);

  const [loadingGroups, setLoadingGroups] = useState(true);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [showMembersModal, setShowMembersModal] = useState(false);
  const [groupMembers, setGroupMembers] = useState([]);
  const [loadingMembers, setLoadingMembers] = useState(false);

  const socketRef = useRef(null);
  const chatBottomRef = useRef(null);
  const fileInputRef = useRef(null);

  // Ref to track activeGroup._id without triggering re-render loops / closure bugs
  const activeGroupIdRef = useRef(null);
  useEffect(() => {
    activeGroupIdRef.current = activeGroup?._id;
  }, [activeGroup?._id]);

  const ERP_MODULE_CARDS = [
    { id: 'Job Card', title: '📋 Job Cards & Stage Tracking', scope: 'jobcards_list', desc: 'Job Card creation, stage movements & production logs' },
    { id: 'Fabric Inventory', title: '📦 Fabric Inventory & Rolls', scope: 'jobcards_fabric', desc: 'Roll inward/outward, stock adjustments & vendor challans' },
    { id: 'Billing Invoice', title: '🧾 Billing & Invoices', scope: 'jobcards_billing', desc: 'GST Invoice generation, billing receipts & ledger edits' },
    { id: 'Design Catalog', title: '🎨 Design Master & Artworks', scope: 'jobcards_catalogue', desc: 'Design additions, artwork pattern approvals & PKD releases' },
    { id: 'Stitching Challan', title: '🧵 Stitching & Garments', scope: 'jobcards_stitching_challan', desc: 'Stitching challan issuances, garment production & finishing' },
    { id: 'Raw Material', title: '🛠️ Raw Material (Paper & Inks)', scope: 'inventory', desc: 'Paper roll inward/outward, ink usage & SKU updates' },
    { id: 'Expense Log', title: '💵 Operational Expenses', scope: 'jobcards_expense', desc: 'Daily petty cash, maintenance receipts & vendor payments' },
    { id: 'Quality Complaint', title: '⚠️ Quality & Complaints', scope: 'jobcards_complain', desc: 'Shade defects, printing complaints & resolution logs' },
  ];

  const ACTION_OPTIONS = [
    { id: 'CREATE', label: '➕ Record Added', desc: 'When a new item is created' },
    { id: 'UPDATE', label: '✏️ Record Edited', desc: 'When details are modified' },
    { id: 'DELETE', label: '🗑️ Record Deleted', desc: 'When an item is removed' },
    { id: 'STAGE_CHANGE', label: '🔄 Stage Shift', desc: 'When workflow status changes' }
  ];

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
      const res = await api.getCommunicationGroups();
      if (res.success && res.data) {
        setGroups(res.data);
        // Only set active group on initial load or if activeGroup was deleted
        setActiveGroup((prev) => {
          if (!prev && res.data.length > 0) return res.data[0];
          if (prev) {
            const exists = res.data.find((g) => String(g._id) === String(prev._id));
            if (!exists) return res.data.length > 0 ? res.data[0] : null;
          }
          return prev;
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
      const res = await api.getCommunicationUsers();
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
        setShowNewDmModal(false);
        await fetchGroups(false);
        setActiveGroup(res.data);
        setRosterTab('direct');
      }
    } catch (err) {
      alert('Failed to open direct message: ' + err.message);
    }
  };

  const handleCreateGroupSubmit = async (e) => {
    e.preventDefault();
    if (!newGroupName.trim()) {
      alert('Please enter a group name.');
      return;
    }
    if (selectedModules.length === 0) {
      alert('Please select at least one subscribed ERP module.');
      return;
    }

    setCreatingGroup(true);
    try {
      const res = await api.createCommunicationGroup({
        name: newGroupName.trim(),
        description: newGroupDesc.trim(),
        department: newGroupDept,
        permissionScope: newGroupScope,
        subscribedModules: selectedModules,
        subscribedActions: selectedActions
      });

      if (res.success && res.data) {
        setShowCreateGroupModal(false);
        setNewGroupName('');
        setNewGroupDesc('');
        await fetchGroups(false);
        setActiveGroup(res.data);
        setRosterTab('groups');
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
    try {
      const res = await api.getCommunicationMembers(activeGroup._id);
      if (res.success && res.data) {
        setGroupMembers(res.data);
      }
    } catch (err) {
      console.error('Failed to fetch group members:', err);
    } finally {
      setLoadingMembers(false);
    }
  };

  const getDMColleague = (group) => {
    if (!group || group.type !== 'direct' || !group.members) return null;
    const myId = currentUser?.id || currentUser?._id;
    return group.members.find((m) => String(m._id || m) !== String(myId)) || group.members[0];
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
        return { bg: '#eff6ff', color: '#1d4ed8', border: '#bfdbfe' };
      case 'DELETE':
        return { bg: '#fee2e2', color: '#b91c1c', border: '#fca5a5' };
      case 'STATUS_CHANGE':
      case 'STAGE_ADVANCE':
      case 'STAGE_CHANGE':
        return { bg: '#f3e8ff', color: '#6b21a8', border: '#d8b4fe' };
      default:
        return { bg: '#f1f5f9', color: '#475569', border: '#cbd5e1' };
    }
  };

  const formatTime = (dtStr) => {
    if (!dtStr) return '';
    try {
      const dt = new Date(dtStr);
      return dt.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });
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

  const toggleModuleSelection = (modId) => {
    if (selectedModules.includes(modId)) {
      setSelectedModules(selectedModules.filter((m) => m !== modId));
    } else {
      setSelectedModules([...selectedModules, modId]);
    }
  };

  const toggleActionSelection = (actId) => {
    if (selectedActions.includes(actId)) {
      setSelectedActions(selectedActions.filter((a) => a !== actId));
    } else {
      setSelectedActions([...selectedActions, actId]);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: 'calc(100vh - 105px)', gap: '0.75rem', overflow: 'hidden' }}>
      
      {/* ── HEADER BAR ── */}
      <div className="glass-panel" style={{ padding: '0.75rem 1.1rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderRadius: '12px', flexShrink: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <div style={{ width: 36, height: 36, borderRadius: '10px', background: 'linear-gradient(135deg, var(--primary) 0%, #1d4ed8 100%)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', boxShadow: '0 4px 12px var(--primary-glow)', flexShrink: 0 }}>
            <MessageSquare size={18} />
          </div>
          <div>
            <h2 style={{ margin: 0, fontSize: '1rem', fontWeight: 800, color: 'var(--text-primary)', letterSpacing: '-0.01em' }}>
              Inter-Department Communication &amp; Activity Stream
            </h2>
            <p style={{ margin: 0, fontSize: '0.72rem', color: 'var(--text-muted)', fontWeight: 500 }}>
              Authority groups, screen activity subscriptions (Add/Edit/Delete), 1-on-1 private DMs &amp; SOS alerts
            </p>
          </div>
        </div>

        {currentUser?.role === 'admin' && (
          <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
            <button
              onClick={() => setShowCreateGroupModal(true)}
              className="btn-primary"
              style={{ fontSize: '0.78rem', padding: '0.4rem 0.85rem', gap: '0.4rem', borderRadius: '8px', background: 'linear-gradient(135deg, #38bdf8 0%, #2563eb 100%)' }}
              title="Create custom activity group with screen trigger rules"
            >
              <PlusCircle size={14} />
              <span>+ Create Activity Group</span>
            </button>

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
        )}
      </div>

      {/* ── MAIN SPLIT VIEW (LEFT = ROSTER | RIGHT = CHAT / STREAM) ── */}
      <div style={{ display: 'grid', gridTemplateColumns: '290px 1fr', gap: '0.75rem', flex: 1, minHeight: 0, overflow: 'hidden' }}>
        
        {/* ════ LEFT COLUMN: GROUPS & DM ROSTER ════ */}
        <div className="glass-panel" style={{ display: 'flex', flexDirection: 'column', height: '100%', borderRadius: '12px', overflow: 'hidden' }}>
          
          {/* Dual Roster Mode Switcher Pills (Groups vs Personal DMs) */}
          <div style={{ padding: '0.5rem 0.65rem', borderBottom: '1px solid var(--border-light)', background: 'var(--bg-th)', display: 'flex', gap: '4px', flexShrink: 0 }}>
            <button
              onClick={() => setRosterTab('groups')}
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
              onClick={() => setRosterTab('direct')}
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
          </div>

          {/* Search Bar & New DM Button */}
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

            {rosterTab === 'direct' && (
              <button
                onClick={handleOpenNewDmModal}
                className="btn-primary"
                style={{ padding: '0.35rem 0.6rem', height: '30px', fontSize: '0.72rem', borderRadius: '6px', gap: '3px' }}
                title="Start 1-on-1 private chat with a colleague"
              >
                <Plus size={13} />
                <span>New</span>
              </button>
            )}
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
                  'No active department groups found.'
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
                const displayName = isDirect ? (colleague ? (colleague.name || colleague.username) : group.name) : group.name;
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
                            {displayName.charAt(0).toUpperCase()}
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

        {/* ════ RIGHT COLUMN: CHAT STREAM & ACTIVITY FEED ════ */}
        <div className="glass-panel" style={{ display: 'flex', flexDirection: 'column', height: '100%', borderRadius: '12px', overflow: 'hidden' }}>
          
          {activeGroup ? (
            <>
              {/* Group / Direct Top Header */}
              {(() => {
                const isDirect = activeGroup.type === 'direct';
                const colleague = isDirect ? getDMColleague(activeGroup) : null;
                const displayName = isDirect ? (colleague ? (colleague.name || colleague.username) : activeGroup.name) : activeGroup.name;

                return (
                  <div style={{ padding: '0.65rem 1rem', borderBottom: '1px solid var(--border-light)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: 'var(--bg-th, #f8fafc)', flexShrink: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
                      {isDirect ? (
                        <div style={{ width: 34, height: 34, borderRadius: '50%', background: 'linear-gradient(135deg, #38bdf8 0%, #2563eb 100%)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontSize: '0.9rem', fontWeight: 800, boxShadow: '0 3px 10px rgba(37,99,235,0.3)' }}>
                          {displayName.charAt(0).toUpperCase()}
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
                            <span>{activeGroup.description || `Scope: ${activeGroup.permissionScope || 'general'}`}</span>
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
                    <div>Loading stream...</div>
                  </div>
                ) : messages.length === 0 ? (
                  <div style={{ margin: 'auto', textAlign: 'center', color: 'var(--text-muted)', padding: '2rem' }}>
                    <Bot size={32} style={{ opacity: 0.3, marginBottom: '0.5rem' }} />
                    <div style={{ fontSize: '0.9rem', fontWeight: 700 }}>No messages logged yet</div>
                    <p style={{ fontSize: '0.78rem', margin: '0.25rem 0 0' }}>
                      Start typing below to send a message.
                    </p>
                  </div>
                ) : (
                  messages.map((msg, index) => {
                    const isSystem = msg.msgType === 'system_activity';
                    const isUrgentMsg = msg.priority === 'urgent';
                    const senderName = msg.senderId?.name || msg.senderId?.username || 'User';
                    const senderRole = msg.senderId?.role || 'user';
                    const isMe = currentUser && String(msg.senderId?._id || msg.senderId) === String(currentUser.id || currentUser._id);
                    const acks = msg.acknowledgments || [];

                    if (isSystem) {
                      const meta = msg.activityMeta || {};
                      const badgeStyle = getActionBadgeStyle(meta.action);

                      return (
                        <div
                          key={msg._id || index}
                          style={{
                            background: 'var(--bg-card)',
                            border: isUrgentMsg ? '1.5px solid #ef4444' : '1px solid var(--border-light)',
                            borderLeft: `4px solid ${isUrgentMsg ? '#ef4444' : getDeptColor(activeGroup.department)}`,
                            borderRadius: '10px',
                            padding: '0.75rem 0.95rem',
                            margin: '0.2rem 0',
                            boxShadow: isUrgentMsg ? '0 4px 14px rgba(239, 68, 68, 0.2)' : 'var(--shadow-sm)'
                          }}
                        >
                          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.35rem' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem', flexWrap: 'wrap' }}>
                              <div style={{ width: 22, height: 22, borderRadius: '50%', background: isUrgentMsg ? '#fee2e2' : 'rgba(37,99,235,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: isUrgentMsg ? '#dc2626' : 'var(--primary)' }}>
                                {isUrgentMsg ? <AlertTriangle size={13} /> : <Bot size={13} />}
                              </div>
                              <span style={{ fontSize: '0.72rem', fontWeight: 800, color: 'var(--text-primary)', letterSpacing: '0.02em' }}>
                                SYSTEM ACTIVITY BOT
                              </span>
                              {isUrgentMsg && (
                                <span style={{ fontSize: '0.62rem', fontWeight: 900, background: '#ef4444', color: '#fff', padding: '1px 6px', borderRadius: '4px' }}>
                                  🚨 URGENT SOS
                                </span>
                              )}
                              <span style={{ fontSize: '0.62rem', fontWeight: 800, padding: '1px 6px', borderRadius: '4px', background: badgeStyle.bg, color: badgeStyle.color, border: `1px solid ${badgeStyle.border}` }}>
                                {meta.action || 'ACTIVITY'}
                              </span>
                              {meta.module && (
                                <span style={{ fontSize: '0.65rem', fontWeight: 700, color: 'var(--text-muted)', background: 'var(--bg-main)', padding: '1px 5px', borderRadius: '3px' }}>
                                  {meta.module}
                                </span>
                              )}
                            </div>
                            <span style={{ fontSize: '0.68rem', color: 'var(--text-muted)', fontWeight: 500 }}>
                              {formatDateLabel(msg.createdAt)} · {formatTime(msg.createdAt)}
                            </span>
                          </div>

                          <div style={{ fontSize: '0.82rem', color: 'var(--text-primary)', fontWeight: 500, lineHeight: 1.4 }}>
                            {renderContentWithMentions(msg.content)}
                          </div>

                          {meta.recordRef && (
                            <div style={{ marginTop: '0.45rem', paddingTop: '0.4rem', borderTop: '1px dashed var(--border-light)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                              <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', fontWeight: 600 }}>
                                Reference Record: <strong style={{ color: 'var(--text-primary)' }}>#{meta.recordRef}</strong>
                              </span>
                              <button
                                onClick={() => handleRecordClick(meta)}
                                style={{ background: 'none', border: 'none', color: 'var(--primary)', fontSize: '0.72rem', fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '3px' }}
                              >
                                <span>Open Module</span>
                                <ExternalLink size={12} />
                              </button>
                            </div>
                          )}

                          {/* Action & Acknowledgment Bar */}
                          <div style={{ marginTop: '0.55rem', paddingTop: '0.45rem', borderTop: '1px solid var(--border-light)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.4rem' }}>
                            <div style={{ display: 'flex', gap: '0.35rem' }}>
                              <button
                                onClick={() => handleAcknowledge(msg._id, 'acknowledged')}
                                style={{ padding: '0.2rem 0.5rem', fontSize: '0.68rem', fontWeight: 700, borderRadius: '4px', border: '1px solid #bfdbfe', background: '#eff6ff', color: '#1d4ed8', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '3px' }}
                              >
                                <ThumbsUp size={11} /> Acknowledge
                              </button>
                              <button
                                onClick={() => handleAcknowledge(msg._id, 'in_progress')}
                                style={{ padding: '0.2rem 0.5rem', fontSize: '0.68rem', fontWeight: 700, borderRadius: '4px', border: '1px solid #fef08a', background: '#fefce8', color: '#a16207', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '3px' }}
                              >
                                <PlayCircle size={11} /> In Progress
                              </button>
                              <button
                                onClick={() => handleAcknowledge(msg._id, 'completed')}
                                style={{ padding: '0.2rem 0.5rem', fontSize: '0.68rem', fontWeight: 700, borderRadius: '4px', border: '1px solid #bbf7d0', background: '#f0fdf4', color: '#15803d', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '3px' }}
                              >
                                <CheckCircle size={11} /> Done
                              </button>
                            </div>

                            {/* Live Acknowledgments List */}
                            {acks.length > 0 && (
                              <div style={{ display: 'flex', gap: '0.25rem', flexWrap: 'wrap' }}>
                                {acks.map((a, aIdx) => (
                                  <span key={aIdx} style={{ fontSize: '0.62rem', fontWeight: 700, padding: '1px 6px', borderRadius: '4px', background: a.action === 'completed' ? '#dcfce7' : a.action === 'in_progress' ? '#fef9c3' : '#dbeafe', color: a.action === 'completed' ? '#166534' : a.action === 'in_progress' ? '#854d0e' : '#1e40af' }}>
                                    ✓ {a.userName} ({a.action})
                                  </span>
                                ))}
                              </div>
                            )}
                          </div>
                        </div>
                      );
                    }

                    // Standard Human Message Bubble
                    return (
                      <div
                        key={msg._id || index}
                        style={{
                          display: 'flex',
                          flexDirection: 'column',
                          alignItems: isMe ? 'flex-end' : 'flex-start',
                          margin: '0.15rem 0'
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', marginBottom: '2px', padding: '0 4px' }}>
                          <span style={{ fontSize: '0.72rem', fontWeight: 800, color: 'var(--text-primary)' }}>{senderName}</span>
                          <span style={{ fontSize: '0.6rem', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 600 }}>({senderRole})</span>
                          <span style={{ fontSize: '0.65rem', color: 'var(--text-muted)' }}>· {formatTime(msg.createdAt)}</span>
                          {isUrgentMsg && (
                            <span style={{ fontSize: '0.6rem', fontWeight: 900, background: '#ef4444', color: '#fff', padding: '1px 5px', borderRadius: '3px' }}>
                              🚨 SOS URGENT
                            </span>
                          )}
                        </div>

                        <div
                          style={{
                            maxWidth: '75%',
                            padding: '0.6rem 0.85rem',
                            borderRadius: isMe ? '12px 12px 2px 12px' : '12px 12px 12px 2px',
                            background: isUrgentMsg
                              ? 'linear-gradient(135deg, #ef4444 0%, #b91c1c 100%)'
                              : isMe
                              ? 'linear-gradient(135deg, var(--primary) 0%, #1d4ed8 100%)'
                              : 'var(--bg-card)',
                            color: isMe || isUrgentMsg ? '#ffffff' : 'var(--text-primary)',
                            border: isUrgentMsg ? '1px solid #ef4444' : isMe ? 'none' : '1px solid var(--border-light)',
                            boxShadow: isUrgentMsg ? '0 4px 14px rgba(239,68,68,0.3)' : isMe ? '0 3px 10px var(--primary-glow)' : 'var(--shadow-sm)',
                            fontSize: '0.85rem',
                            lineHeight: 1.4,
                            wordBreak: 'break-word'
                          }}
                        >
                          {/* Image / Attachment Preview */}
                          {msg.attachment && msg.attachment.fileUrl && (
                            <div style={{ marginBottom: '0.4rem' }}>
                              {msg.attachment.fileType === 'image' || msg.attachment.fileUrl.startsWith('data:image') ? (
                                <div style={{ borderRadius: '6px', overflow: 'hidden', border: '1px solid rgba(255,255,255,0.2)', cursor: 'zoom-in', maxWith: 220, maxHeight: 180 }}>
                                  <img
                                    src={msg.attachment.fileUrl}
                                    alt="attachment"
                                    style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                                    onClick={() => setZoomImg(msg.attachment.fileUrl)}
                                  />
                                </div>
                              ) : (
                                <a
                                  href={msg.attachment.fileUrl}
                                  target="_blank"
                                  rel="noreferrer"
                                  style={{ color: isMe || isUrgentMsg ? '#fff' : 'var(--primary)', fontSize: '0.75rem', fontWeight: 700, display: 'inline-flex', alignItems: 'center', gap: '4px' }}
                                >
                                  <FileText size={14} />
                                  <span>{msg.attachment.fileName || 'Download Attachment'}</span>
                                </a>
                              )}
                            </div>
                          )}

                          {renderContentWithMentions(msg.content)}
                        </div>
                      </div>
                    );
                  })
                )}
                <div ref={chatBottomRef} />
              </div>

              {/* Attachment Preview Badge */}
              {attachedFile && (
                <div style={{ padding: '0.4rem 1rem', background: '#f1f5f9', borderTop: '1px solid var(--border-light)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.75rem', color: '#1e293b', fontWeight: 700 }}>
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
            <div style={{ margin: 'auto', textAlign: 'center', color: 'var(--text-muted)' }}>
              Select a group or contact from the left roster to view messages.
            </div>
          )}
        </div>
      </div>

      {/* ── DETAILED ADMIN CREATE CUSTOM ACTIVITY GROUP FORM MODAL ── */}
      {showCreateGroupModal && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 9999, background: 'rgba(15, 23, 42, 0.65)', backdropFilter: 'blur(5px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem' }}>
          <div className="glass-panel" style={{ width: '100%', maxWidth: 680, maxHeight: '90vh', borderRadius: '16px', overflow: 'hidden', display: 'flex', flexDirection: 'column', animation: 'slideUp 0.2s ease-out', boxShadow: '0 20px 40px rgba(0,0,0,0.3)' }}>
            
            {/* Modal Header */}
            <div style={{ padding: '1.1rem 1.4rem', borderBottom: '1px solid var(--border-light)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'linear-gradient(135deg, #0f172a 0%, #1e293b 100%)', color: '#fff' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                <div style={{ width: 36, height: 36, borderRadius: '10px', background: 'linear-gradient(135deg, #38bdf8 0%, #2563eb 100%)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff' }}>
                  <Sliders size={20} />
                </div>
                <div>
                  <h3 style={{ margin: 0, fontSize: '1.05rem', fontWeight: 800, letterSpacing: '-0.01em', color: '#fff' }}>
                    Create Screen Activity Communication Group
                  </h3>
                  <p style={{ margin: 0, fontSize: '0.72rem', color: '#94a3b8', fontWeight: 500 }}>
                    Configure automatic screen event streaming, module subscriptions &amp; team access
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

            {/* Modal Scrollable Form Content */}
            <form onSubmit={handleCreateGroupSubmit} style={{ padding: '1.3rem 1.4rem', overflowY: 'auto', flex: 1, display: 'flex', flexDirection: 'column', gap: '1.1rem' }}>
              
              {/* SECTION 1: GENERAL DETAILS */}
              <div style={{ background: 'var(--bg-main)', padding: '1rem', borderRadius: '10px', border: '1px solid var(--border-light)' }}>
                <h4 style={{ margin: '0 0 0.75rem', fontSize: '0.85rem', fontWeight: 800, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <Info size={15} color="var(--primary)" />
                  <span>1. General Information</span>
                </h4>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                  <div>
                    <label style={{ display: 'block', fontSize: '0.76rem', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '4px' }}>
                      Group Name *
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. Stitching & Production Live Activity Stream"
                      value={newGroupName}
                      onChange={(e) => setNewGroupName(e.target.value)}
                      style={{ width: '100%', padding: '0.55rem 0.8rem', fontSize: '0.82rem', borderRadius: '8px', border: '1px solid var(--border-light)', background: 'var(--bg-card)', color: 'var(--text-primary)', boxSizing: 'border-box' }}
                      required
                    />
                  </div>

                  <div>
                    <label style={{ display: 'block', fontSize: '0.76rem', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '4px' }}>
                      Detailed Group Description
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. Live automated logs for garment production, stitching challan releases & defect reports"
                      value={newGroupDesc}
                      onChange={(e) => setNewGroupDesc(e.target.value)}
                      style={{ width: '100%', padding: '0.55rem 0.8rem', fontSize: '0.82rem', borderRadius: '8px', border: '1px solid var(--border-light)', background: 'var(--bg-card)', color: 'var(--text-primary)', boxSizing: 'border-box' }}
                    />
                  </div>
                </div>
              </div>

              {/* SECTION 2: DEPARTMENT & VIEW ACCESS SCOPE */}
              <div style={{ background: 'var(--bg-main)', padding: '1rem', borderRadius: '10px', border: '1px solid var(--border-light)' }}>
                <h4 style={{ margin: '0 0 0.75rem', fontSize: '0.85rem', fontWeight: 800, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <Shield size={15} color="var(--primary)" />
                  <span>2. Department Category &amp; Access Authority Scope</span>
                </h4>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.85rem' }}>
                  <div>
                    <label style={{ display: 'block', fontSize: '0.76rem', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '4px' }}>
                      Department Category
                    </label>
                    <select
                      value={newGroupDept}
                      onChange={(e) => setNewGroupDept(e.target.value)}
                      style={{ width: '100%', padding: '0.55rem 0.8rem', fontSize: '0.82rem', borderRadius: '8px', border: '1px solid var(--border-light)', background: 'var(--bg-card)', color: 'var(--text-primary)' }}
                    >
                      <option value="Production">Production</option>
                      <option value="Stitching">Stitching</option>
                      <option value="Billing">Billing</option>
                      <option value="Fabric">Fabric</option>
                      <option value="Design">Design</option>
                      <option value="Inventory">Inventory</option>
                      <option value="Quality">Quality</option>
                      <option value="Finance">Finance</option>
                      <option value="General">General</option>
                    </select>
                  </div>

                  <div>
                    <label style={{ display: 'block', fontSize: '0.76rem', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '4px' }}>
                      View Access Permission Scope
                    </label>
                    <select
                      value={newGroupScope}
                      onChange={(e) => setNewGroupScope(e.target.value)}
                      style={{ width: '100%', padding: '0.55rem 0.8rem', fontSize: '0.82rem', borderRadius: '8px', border: '1px solid var(--border-light)', background: 'var(--bg-card)', color: 'var(--text-primary)' }}
                    >
                      <option value="jobcards_list">Job Cards Access (jobcards_list)</option>
                      <option value="jobcards_fabric">Fabric Store Access (jobcards_fabric)</option>
                      <option value="jobcards_billing">Billing Access (jobcards_billing)</option>
                      <option value="jobcards_stitching_challan">Stitching Access (jobcards_stitching_challan)</option>
                      <option value="jobcards_catalogue">Design Catalog Access (jobcards_catalogue)</option>
                      <option value="jobcards_expense">Expense Log Access (jobcards_expense)</option>
                      <option value="jobcards_complain">Quality Complaints (jobcards_complain)</option>
                      <option value="general">All Authorized Staff (General)</option>
                    </select>
                  </div>
                </div>
              </div>

              {/* SECTION 3: SUBSCRIBED ERP MODULES */}
              <div style={{ background: 'var(--bg-main)', padding: '1rem', borderRadius: '10px', border: '1px solid var(--border-light)' }}>
                <h4 style={{ margin: '0 0 0.4rem', fontSize: '0.85rem', fontWeight: 800, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <Layers size={15} color="var(--primary)" />
                  <span>3. Subscribed ERP Screens / Modules</span>
                </h4>
                <p style={{ margin: '0 0 0.75rem', fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                  Activities performed on checked screens will automatically post live cards into this group.
                </p>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem' }}>
                  {ERP_MODULE_CARDS.map((mod) => {
                    const isChecked = selectedModules.includes(mod.id);
                    return (
                      <div
                        key={mod.id}
                        onClick={() => toggleModuleSelection(mod.id)}
                        style={{
                          padding: '0.6rem 0.75rem',
                          borderRadius: '8px',
                          border: isChecked ? '1.5px solid #2563eb' : '1px solid var(--border-light)',
                          background: isChecked ? '#eff6ff' : 'var(--bg-card)',
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'flex-start',
                          gap: '8px',
                          transition: 'all 0.15s ease'
                        }}
                      >
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={() => {}}
                          style={{ marginTop: '2px', cursor: 'pointer' }}
                        />
                        <div>
                          <div style={{ fontSize: '0.78rem', fontWeight: 800, color: isChecked ? '#1d4ed8' : 'var(--text-primary)' }}>
                            {mod.title}
                          </div>
                          <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)', marginTop: '2px', lineHeight: 1.25 }}>
                            {mod.desc}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* SECTION 4: TRIGGER OPERATIONS */}
              <div style={{ background: 'var(--bg-main)', padding: '1rem', borderRadius: '10px', border: '1px solid var(--border-light)' }}>
                <h4 style={{ margin: '0 0 0.4rem', fontSize: '0.85rem', fontWeight: 800, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <Zap size={15} color="var(--primary)" />
                  <span>4. Subscribed Activity Operations</span>
                </h4>
                <p style={{ margin: '0 0 0.75rem', fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                  Choose which user actions trigger activity cards.
                </p>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem' }}>
                  {ACTION_OPTIONS.map((act) => {
                    const isChecked = selectedActions.includes(act.id);
                    return (
                      <div
                        key={act.id}
                        onClick={() => toggleActionSelection(act.id)}
                        style={{
                          padding: '0.6rem 0.75rem',
                          borderRadius: '8px',
                          border: isChecked ? '1.5px solid #2563eb' : '1px solid var(--border-light)',
                          background: isChecked ? '#eff6ff' : 'var(--bg-card)',
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'flex-start',
                          gap: '8px',
                          transition: 'all 0.15s ease'
                        }}
                      >
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={() => {}}
                          style={{ marginTop: '2px', cursor: 'pointer' }}
                        />
                        <div>
                          <div style={{ fontSize: '0.78rem', fontWeight: 800, color: isChecked ? '#1d4ed8' : 'var(--text-primary)' }}>
                            {act.label}
                          </div>
                          <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)', marginTop: '2px' }}>
                            {act.desc}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Submit Buttons */}
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.6rem', marginTop: '0.5rem' }}>
                <button
                  type="button"
                  onClick={() => setShowCreateGroupModal(false)}
                  className="btn-secondary"
                  style={{ fontSize: '0.82rem', padding: '0.5rem 1rem', borderRadius: '8px' }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={creatingGroup}
                  className="btn-primary"
                  style={{ fontSize: '0.82rem', padding: '0.5rem 1.25rem', borderRadius: '8px', background: 'linear-gradient(135deg, #38bdf8 0%, #2563eb 100%)', boxShadow: '0 4px 12px rgba(37,99,235,0.3)' }}
                >
                  {creatingGroup ? 'Creating Group...' : 'Create Activity Group'}
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
          <div className="glass-panel" style={{ width: '100%', maxWidth: 520, borderRadius: '14px', overflow: 'hidden', animation: 'slideUp 0.2s ease-out' }}>
            <div style={{ padding: '1rem 1.2rem', borderBottom: '1px solid var(--border-light)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'var(--bg-th)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <Users size={18} color="var(--primary)" />
                <h3 style={{ margin: 0, fontSize: '0.95rem', fontWeight: 800, color: 'var(--text-primary)' }}>
                  Authorized Members — {activeGroup.name}
                </h3>
              </div>
              <button onClick={() => setShowMembersModal(false)} className="btn-secondary" style={{ padding: '0.2rem 0.5rem', fontSize: '0.75rem', borderRadius: '6px' }}>
                Close
              </button>
            </div>

            <div style={{ padding: '1rem', maxHeight: '60vh', overflowY: 'auto' }}>
              {loadingMembers ? (
                <div style={{ textAlign: 'center', padding: '1.5rem', color: 'var(--text-muted)' }}>
                  <RefreshCw size={18} className="spin-loader" />
                  <div style={{ fontSize: '0.8rem', marginTop: '0.4rem' }}>Loading group authorities...</div>
                </div>
              ) : groupMembers.length === 0 ? (
                <div style={{ textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.8rem', padding: '1rem' }}>
                  No individual members assigned. System auto-includes all users with <code>{activeGroup.permissionScope}</code> permission.
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
