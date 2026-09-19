import React, { useState, useEffect, useRef, useMemo } from 'react';
import { api, getBaseUrl } from '../services/api';
import { useSocket } from '../contexts/SocketContext';
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
  CheckSquare,
  Mic,
  Square,
  Pin,
  PinOff,
  Folder,
  Volume2,
  VolumeX,
  Smile,
  Play,
  Pause,
  Eye,
  Check,
  CheckCheck,
  Share2,
  FilePlus,
  BarChart2,
  Reply,
  CornerUpRight
} from 'lucide-react';


export default function CommunicationPanel({ currentUser, onNavigateTab, initialMainTab = 'chat', onUnreadChange }) {
  const [mainTab, setMainTab] = useState(initialMainTab); // 'chat' | 'task'

  useEffect(() => {
    if (initialMainTab) {
      setMainTab(initialMainTab);
    }
  }, [initialMainTab]);
  const [groups, setGroups] = useState([]);
  const [activeGroup, setActiveGroup] = useState(null);
  const [messages, setMessages] = useState([]);
  const [inputMessage, setInputMessage] = useState('');
  const [roomDrafts, setRoomDrafts] = useState({});
  const [searchQuery, setSearchQuery] = useState('');

  // Real-time unread count badges calculations
  const groupUnreadCount = useMemo(() => {
    return groups
      .filter((g) => g.type !== 'direct')
      .reduce((acc, g) => acc + (Number(g.unreadCount) || 0), 0);
  }, [groups]);

  const dmUnreadCount = useMemo(() => {
    return groups
      .filter((g) => g.type === 'direct')
      .reduce((acc, g) => acc + (Number(g.unreadCount) || 0), 0);
  }, [groups]);

  const totalChatUnreadCount = groupUnreadCount + dmUnreadCount;

  useEffect(() => {
    if (typeof onUnreadChange === 'function') {
      onUnreadChange(totalChatUnreadCount);
    }
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('chat-unread-count-change', { detail: { count: totalChatUnreadCount } }));
    }
  }, [totalChatUnreadCount, onUnreadChange]);

  // Auto-restore draft message per room/DM conversation
  useEffect(() => {
    if (!activeGroup?._id) return;
    setInputMessage(roomDrafts[activeGroup._id] || '');
  }, [activeGroup?._id]);
  const [msgFilter, setMsgFilter] = useState('all'); // 'all' | 'human' | 'system_activity' | 'urgent' | 'media'
  const [rosterTab, setRosterTab] = useState('groups'); // 'groups' | 'direct'
  const [isUrgent, setIsUrgent] = useState(false);
  const [attachedFile, setAttachedFile] = useState(null);
  const [zoomImg, setZoomImg] = useState(null);
  const [showInRoomSearch, setShowInRoomSearch] = useState(false);
  const [inRoomQuery, setInRoomQuery] = useState('');
  const [showPinnedOnly, setShowPinnedOnly] = useState(false);
  const [chatSoundMuted, setChatSoundMuted] = useState(() => typeof localStorage !== 'undefined' ? localStorage.getItem('elite_chat_sound_muted') === 'true' : false);
  const [playingAudioId, setPlayingAudioId] = useState(null);
  const [isMobileScreen, setIsMobileScreen] = useState(() => typeof window !== 'undefined' && window.innerWidth < 768);

  useEffect(() => {
    const handleResize = () => {
      setIsMobileScreen(window.innerWidth < 768);
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

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

  // ── NEW CHAT ENHANCEMENT STATES ──
  // Voice Recording
  const [isRecordingAudio, setIsRecordingAudio] = useState(false);
  const [recordingSeconds, setRecordingSeconds] = useState(0);
  const mediaRecorderRef = useRef(null);
  const audioChunksRef = useRef([]);
  const recordingTimerRef = useRef(null);
  const recordingSecondsRef = useRef(0);

  // Quick Share Record Cards Modal
  const [showShareModal, setShowShareModal] = useState(false);
  const [shareRecordCategory, setShareRecordCategory] = useState('jobcard'); // 'jobcard' | 'design' | 'invoice' | 'complaint'
  const [shareRecordCompany, setShareRecordCompany] = useState(''); // '' = All Companies
  const [shareTargetRoomId, setShareTargetRoomId] = useState(''); // Direct target room
  const [shareRecordSearch, setShareRecordSearch] = useState('');
  const [shareRecordItems, setShareRecordItems] = useState([]);
  const [loadingShareItems, setLoadingShareItems] = useState(false);

  // Shared Media & Document Gallery Modal
  const [showGalleryModal, setShowGalleryModal] = useState(false);
  const [galleryTab, setGalleryTab] = useState('all'); // 'all' | 'image' | 'document' | 'audio'

  // Quoted Inline Reply state
  const [replyToMessage, setReplyToMessage] = useState(null);

  // Interactive Poll Modal State
  const [showPollModal, setShowPollModal] = useState(false);
  const [pollQuestion, setPollQuestion] = useState('');
  const [pollOptions, setPollOptions] = useState(['', '']);
  const [pollMultiSelect, setPollMultiSelect] = useState(false);
  const [submittingPoll, setSubmittingPoll] = useState(false);

  // Cross-Room Message Forwarding Modal State
  const [showForwardModal, setShowForwardModal] = useState(false);
  const [forwardTargetMsg, setForwardTargetMsg] = useState(null);
  const [forwardTargetRoomId, setForwardTargetRoomId] = useState('');
  const [forwardingMsg, setForwardingMsg] = useState(false);

  // Infinite Scroll Pagination State
  const [page, setPage] = useState(1);
  const [hasMoreMessages, setHasMoreMessages] = useState(true);
  const [loadingMoreMessages, setLoadingMoreMessages] = useState(false);
  const chatScrollRef = useRef(null);

  // Admin Clear All Data Modal State
  const [showClearAllModal, setShowClearAllModal] = useState(false);
  const [clearingData, setClearingData] = useState(false);

  const socket = useSocket();
  const chatBottomRef = useRef(null);
  const fileInputRef = useRef(null);

  // Ref to track activeGroup._id without triggering re-render loops / closure bugs
  const activeGroupIdRef = useRef(null);
  useEffect(() => {
    activeGroupIdRef.current = activeGroup?._id;
  }, [activeGroup?._id]);

  // Initialize Socket.io connection listeners & fetch groups & user directory
  useEffect(() => {
    fetchGroups();

    const uId = currentUser?._id || currentUser?.id;
    if (uId) {
      api.getCommunicationUsers(uId).then((res) => {
        if (res.success && res.data) {
          setAllUsers(res.data);
        }
      }).catch((e) => console.warn('Failed to fetch initial staff users:', e));
    }

    if (!socket) return;

    const handleConnect = () => {
      if (uId) {
        socket.emit('register-user', uId);
      }
      if (activeGroupIdRef.current) {
        socket.emit('join-room', activeGroupIdRef.current);
      }
    };

    handleConnect();

    const handleReceiveMessage = (msg) => {
      const currentActiveId = activeGroupIdRef.current;
      if (currentActiveId && String(msg.roomId) === String(currentActiveId)) {
        setMessages((prev) => {
          // Filter out optimistic placeholder if real message arrives
          const filtered = prev.filter((m) => !(m.isOptimistic && (m.content === msg.content || String(m._id) === String(msg._id))));
          if (filtered.some((m) => String(m._id) === String(msg._id))) return filtered;
          return [...filtered, msg];
        });
        if (socket && uId) {
          socket.emit('read-room-messages', { roomId: currentActiveId, userId: uId });
        }
      }

      setGroups((prevGroups) => {
        return prevGroups.map((g) => {
          if (String(g._id) === String(msg.roomId)) {
            const isCurrentActive = currentActiveId && String(g._id) === String(currentActiveId);
            const newUnread = isCurrentActive ? 0 : (g.unreadCount || 0) + 1;
            return {
              ...g,
              lastMessage: msg,
              unreadCount: newUnread,
              updatedAt: msg.createdAt || new Date().toISOString()
            };
          }
          return g;
        }).sort((a, b) => new Date(b.updatedAt || 0) - new Date(a.updatedAt || 0));
      });

      fetchGroups(false);
    };

    const handleAck = (data) => {
      if (data && data.messageId) {
        setMessages((prev) =>
          prev.map((m) =>
            String(m._id) === String(data.messageId)
              ? { ...m, acknowledgments: data.acknowledgments }
              : m
          )
        );
      }
    };

    const handleActivity = () => {
      fetchGroups(false);
    };

    const handleReaction = (data) => {
      if (data && data.messageId) {
        setMessages((prev) =>
          prev.map((m) =>
            String(m._id) === String(data.messageId)
              ? { ...m, reactions: data.reactions }
              : m
          )
        );
      }
    };

    const handleEdited = (data) => {
      if (data && data.messageId) {
        setMessages((prev) =>
          prev.map((m) =>
            String(m._id) === String(data.messageId)
              ? { ...m, content: data.newContent, isEdited: true }
              : m
          )
        );
      }
    };

    const handleDeleted = (data) => {
      if (data && data.messageId) {
        setMessages((prev) =>
          prev.map((m) =>
            String(m._id) === String(data.messageId)
              ? { ...m, content: 'This message was deleted', isDeleted: true, attachment: null }
              : m
          )
        );
      }
    };

    const handlePinUpdated = (data) => {
      if (data && data.messageId) {
        setMessages((prev) =>
          prev.map((m) =>
            String(m._id) === String(data.messageId)
              ? { ...m, isPinned: data.isPinned }
              : m
          )
        );
      }
    };

    const handleRoomMessagesRead = (data) => {
      if (data && data.userId && data.roomId) {
        const currentActiveId = activeGroupIdRef.current;
        if (currentActiveId && String(data.roomId) === String(currentActiveId)) {
          setMessages((prev) =>
            prev.map((m) => {
              const myId = String(currentUser?._id || currentUser?.id || '');
              const readArr = m.readBy ? m.readBy.map((u) => String(typeof u === 'object' ? (u._id || u.id) : u)) : [];
              if (!readArr.includes(String(data.userId))) {
                return { ...m, readBy: [...(m.readBy || []), data.userId] };
              }
              return m;
            })
          );
        }
      }
    };

    const handlePollUpdated = (data) => {
      if (data && data.messageId && data.pollMeta) {
        setMessages((prev) =>
          prev.map((m) =>
            String(m._id) === String(data.messageId)
              ? { ...m, pollMeta: data.pollMeta }
              : m
          )
        );
      }
    };

    const handleDataCleared = () => {
      setMessages([]);
      fetchGroups(true);
    };

    socket.on('connect', handleConnect);
    socket.on('receive-message', handleReceiveMessage);
    socket.on('message-acknowledged', handleAck);
    socket.on('activity-notification', handleActivity);
    socket.on('message-reaction-updated', handleReaction);
    socket.on('message-edited', handleEdited);
    socket.on('message-deleted', handleDeleted);
    socket.on('message-pin-updated', handlePinUpdated);
    socket.on('room-messages-read', handleRoomMessagesRead);
    socket.on('poll-updated', handlePollUpdated);
    socket.on('communication-data-cleared', handleDataCleared);

    return () => {
      socket.off('connect', handleConnect);
      socket.off('receive-message', handleReceiveMessage);
      socket.off('message-acknowledged', handleAck);
      socket.off('activity-notification', handleActivity);
      socket.off('message-reaction-updated', handleReaction);
      socket.off('message-edited', handleEdited);
      socket.off('message-deleted', handleDeleted);
      socket.off('message-pin-updated', handlePinUpdated);
      socket.off('room-messages-read', handleRoomMessagesRead);
      socket.off('poll-updated', handlePollUpdated);
      socket.off('communication-data-cleared', handleDataCleared);
    };
  }, [socket, currentUser]);

  // Join socket room when active group changes & fetch messages explicitly with loader
  useEffect(() => {
    if (!activeGroup) return;

    if (socket) {
      socket.emit('join-room', activeGroup._id);
    }

    fetchGroupMessages(activeGroup._id, msgFilter, true);
  }, [socket, activeGroup?._id, msgFilter]);

  const handleSelectGroup = (targetGroup) => {
    if (!targetGroup) return;
    if (activeGroup?._id && inputMessage) {
      setRoomDrafts((prev) => ({
        ...prev,
        [activeGroup._id]: inputMessage
      }));
    }
    setActiveGroup(targetGroup);
    if (typeof localStorage !== 'undefined' && targetGroup._id) {
      localStorage.setItem('elite_active_chat_room_id', targetGroup._id);
    }
    setInputMessage(roomDrafts[targetGroup._id] || '');
    if (socket && targetGroup._id) {
      socket.emit('join-room', targetGroup._id);
    }
    fetchGroupMessages(targetGroup._id, msgFilter, true);
  };

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
        setGroups((prev) => {
          const serverMap = new Map();
          res.data.forEach((g) => serverMap.set(String(g._id), g));

          // Retain local direct rooms if server hasn't returned them yet
          prev.forEach((g) => {
            if (g.type === 'direct' && !serverMap.has(String(g._id))) {
              serverMap.set(String(g._id), g);
            }
          });

          return Array.from(serverMap.values());
        });

        const savedRoomId = typeof localStorage !== 'undefined' ? localStorage.getItem('elite_active_chat_room_id') : null;

        setActiveGroup((prev) => {
          if (!prev) {
            if (savedRoomId) {
              const matched = res.data.find((g) => String(g._id) === String(savedRoomId));
              if (matched) return matched;
            }
            return res.data.length > 0 ? res.data[0] : null;
          }
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

        const myId = currentUser?._id || currentUser?.id;
        if (socket && myId && groupId) {
          socket.emit('read-room-messages', { roomId: groupId, userId: myId });
        }
        setGroups((prev) =>
          prev.map((g) => (String(g._id) === String(groupId) ? { ...g, unreadCount: 0 } : g))
        );
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
      const targetId = targetUser._id || targetUser.id;
      const res = await api.createOrGetDirectRoom(targetId, myId);
      if (res.success && res.data) {
        const dmRoom = res.data;
        setShowNewDmModal(false);
        setRosterTab('direct');
        setActiveGroup(dmRoom);
        setGroups((prev) => {
          const exists = prev.some((g) => String(g._id) === String(dmRoom._id));
          return exists ? prev : [dmRoom, ...prev];
        });
        if (socket && dmRoom._id) {
          socket.emit('join-room', dmRoom._id);
        }
        fetchGroupMessages(dmRoom._id, msgFilter, true);
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

  const [uploadingFile, setUploadingFile] = useState(false);

  const handleFileUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    if (file.size > 100 * 1024 * 1024) {
      alert('File size exceeds 100MB limit.');
      return;
    }

    setUploadingFile(true);
    try {
      let uploadFile = file;
      if (file.type && file.type.startsWith('image/')) {
        try {
          const imageCompression = (await import('browser-image-compression')).default;
          uploadFile = await imageCompression(file, { maxSizeMB: 2, maxWidthOrHeight: 2560, useWebWorker: true });
        } catch (err) {
          uploadFile = file;
        }
      }

      const roomName = activeGroup?.name || 'General';
      const res = await api.uploadChatAttachment(uploadFile, roomName);
      if (res && res.fileUrl) {
        setAttachedFile({
          fileName: res.fileName || file.name,
          fileType: file.type.startsWith('image/') ? 'image' : file.type.startsWith('audio/') ? 'audio' : 'document',
          fileUrl: res.fileUrl,
          fileSize: res.fileSize || file.size,
        });
      } else {
        alert('Failed to upload attachment to Cloudflare R2.');
      }
    } catch (err) {
      alert('File upload failed: ' + err.message);
    } finally {
      setUploadingFile(false);
    }
  };

  // ── AUDIO VOICE NOTE RECORDING HANDLERS ──
  const startAudioRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      audioChunksRef.current = [];
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;

      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) audioChunksRef.current.push(e.data);
      };

      mediaRecorder.onstop = async () => {
        stream.getTracks().forEach((track) => track.stop());
        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
        if (audioBlob.size === 0) return;

        const audioFile = new File([audioBlob], `voice_note_${Date.now()}.webm`, { type: 'audio/webm' });
        setUploadingFile(true);
        try {
          const roomName = activeGroup?.name || 'General';
          const res = await api.uploadChatAttachment(audioFile, roomName);
          if (res && res.fileUrl) {
            setAttachedFile({
              fileName: `Voice Note (${recordingSecondsRef.current || 5}s)`,
              fileType: 'audio',
              fileUrl: res.fileUrl,
              fileSize: res.fileSize || audioBlob.size,
              durationSec: recordingSecondsRef.current || 5
            });
          }
        } catch (err) {
          alert('Failed to upload voice note: ' + err.message);
        } finally {
          setUploadingFile(false);
        }
      };

      mediaRecorder.start();
      setIsRecordingAudio(true);
      setRecordingSeconds(0);
      recordingSecondsRef.current = 0;
      if (recordingTimerRef.current) clearInterval(recordingTimerRef.current);
      recordingTimerRef.current = setInterval(() => {
        setRecordingSeconds((prev) => {
          recordingSecondsRef.current = prev + 1;
          return prev + 1;
        });
      }, 1000);
    } catch (err) {
      alert('Microphone access denied or not supported: ' + err.message);
    }
  };

  const stopAudioRecording = () => {
    if (recordingTimerRef.current) clearInterval(recordingTimerRef.current);
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop();
    }
    setIsRecordingAudio(false);
  };

  const cancelAudioRecording = () => {
    if (recordingTimerRef.current) clearInterval(recordingTimerRef.current);
    if (mediaRecorderRef.current) {
      mediaRecorderRef.current.onstop = null;
      if (mediaRecorderRef.current.state !== 'inactive') {
        mediaRecorderRef.current.stop();
      }
    }
    setIsRecordingAudio(false);
    setRecordingSeconds(0);
  };

  // ── QUICK SHARE RECORD CARDS HANDLERS ──
  const handleOpenShareModal = async (cat = 'jobcard') => {
    setShareRecordCategory(cat);
    setShareRecordSearch('');
    setShareRecordCompany('');
    setShareTargetRoomId(activeGroup?._id || '');
    setShowShareModal(true);
    fetchShareRecordItems(cat, '', '');
  };

  const handleCompanyChangeInShareModal = (newCompany) => {
    setShareRecordCompany(newCompany);
    if (newCompany) {
      const cLow = newCompany.toLowerCase();
      const match = groups.find((g) => {
        if (g.type === 'direct') return false;
        const gName = (g.name || '').toLowerCase();
        const gComp = (g.companyEntity || '').toLowerCase();
        const gDept = (g.department || '').toLowerCase();
        if (cLow.includes('print')) {
          return gComp.includes('print') || gName.includes('print') || gDept.includes('production');
        }
        if (cLow.includes('online')) {
          return gComp.includes('online') || gName.includes('online') || gDept.includes('e-commerce') || gName.includes('sales');
        }
        if (cLow.includes('stitching')) {
          return gComp.includes('stitching') || gName.includes('stitching');
        }
        if (cLow.includes('fabtex')) {
          return gComp.includes('fabtex') || gName.includes('fabtex');
        }
        if (cLow.includes('edition')) {
          return gComp.includes('edition') || gName.includes('operations') || gName.includes('admin') || gDept.includes('admin');
        }
        return gComp.includes(cLow) || gName.includes(cLow);
      });
      if (match) {
        setShareTargetRoomId(match._id);
      }
    } else {
      setShareTargetRoomId(activeGroup?._id || '');
    }
  };

  const fetchShareRecordItems = async (cat, searchTerm = '', comp = shareRecordCompany) => {
    setLoadingShareItems(true);
    try {
      let items = [];
      const cleanSearch = (searchTerm || '').trim();
      if (cat === 'jobcard') {
        const params = { limit: 50, sortBy: 'jobNo', sortOrder: 'desc' };
        if (cleanSearch) params.search = cleanSearch;
        if (comp === 'Elite Digital Print') {
          params.department = 'digital_print';
        } else if (comp === 'Elite Stitching') {
          params.department = 'stitching';
        } else if (comp === 'Elite Fabtex') {
          params.party = 'FABTEX';
        } else if (comp === 'Elite Edition') {
          params.party = 'ELITE EDITION';
        }
        const res = await api.getJobCards(params);
        let list = Array.isArray(res) ? res : (res?.data || []);
        if (comp && !params.department && !params.party) {
          const cLow = comp.toLowerCase();
          list = list.filter((item) =>
            (item.party && item.party.toLowerCase().includes(cLow)) ||
            (item.department && item.department.toLowerCase().includes(cLow)) ||
            (item.companyEntity && item.companyEntity.toLowerCase().includes(cLow))
          );
        }
        items = list;
      } else if (cat === 'design') {
        const params = { limit: 50, sortBy: 'createdAt', sortOrder: 'desc' };
        if (cleanSearch) params.search = cleanSearch;
        const res = await (api.getDesigns ? api.getDesigns(params) : api.getDesignCatalogue(params));
        let list = Array.isArray(res) ? res : (res?.data || []);
        if (comp) {
          const cLow = comp.toLowerCase();
          list = list.filter((d) =>
            (d.companyEntity && d.companyEntity.toLowerCase().includes(cLow)) ||
            (d.party && d.party.toLowerCase().includes(cLow)) ||
            (d.category && d.category.toLowerCase().includes(cLow)) ||
            (d.department && d.department.toLowerCase().includes(cLow))
          );
        }
        items = list;
      } else if (cat === 'invoice') {
        const params = { limit: 50 };
        if (cleanSearch) params.search = cleanSearch;
        if (comp) params.companyEntity = comp;
        const res = await api.getBillingInvoices(params);
        let list = Array.isArray(res) ? res : (res?.data || []);
        if (comp && !params.companyEntity) {
          const cLow = comp.toLowerCase();
          list = list.filter((inv) =>
            (inv.companyEntity && inv.companyEntity.toLowerCase().includes(cLow)) ||
            (inv.partyName && inv.partyName.toLowerCase().includes(cLow))
          );
        }
        items = list;
      } else if (cat === 'complaint') {
        const params = { limit: 50 };
        if (cleanSearch) params.search = cleanSearch;
        if (comp) params.companyEntity = comp;
        const res = await api.getComplaints(params);
        let list = Array.isArray(res) ? res : (res?.data || []);
        if (comp) {
          const cLow = comp.toLowerCase();
          list = list.filter((cmp) =>
            (cmp.companyEntity && cmp.companyEntity.toLowerCase().includes(cLow)) ||
            (cmp.departmentName && cmp.departmentName.toLowerCase().includes(cLow))
          );
        }
        items = list;
      }
      setShareRecordItems(items);
    } catch (err) {
      console.error('Failed to fetch share items:', err);
      setShareRecordItems([]);
    } finally {
      setLoadingShareItems(false);
    }
  };

  // Debounced search for Quick Share Records
  useEffect(() => {
    if (!showShareModal) return;
    const timer = setTimeout(() => {
      fetchShareRecordItems(shareRecordCategory, shareRecordSearch, shareRecordCompany);
    }, 250);
    return () => clearTimeout(timer);
  }, [shareRecordSearch, shareRecordCategory, shareRecordCompany, showShareModal]);

  const handleShareRecordToChat = (item) => {
    const targetRoomId = shareTargetRoomId || activeGroup?._id;
    if (!targetRoomId) return;

    const targetRoom = groups.find((g) => String(g._id) === String(targetRoomId)) || activeGroup;
    const isCurrentRoom = activeGroup && String(activeGroup._id) === String(targetRoomId);

    const myId = currentUser?.id || currentUser?._id;
    let cardTitle = '';
    let refVal = '';
    let scopeVal = '';

    if (shareRecordCategory === 'jobcard') {
      refVal = `JC-${item.jobNo}`;
      cardTitle = `Job Card #${item.jobNo} — ${item.party || 'Client'}`;
      scopeVal = 'jobcards';
    } else if (shareRecordCategory === 'design') {
      refVal = `DES-${item.designNo || item.designName}`;
      cardTitle = `Design: ${item.designName || item.designNo}`;
      scopeVal = 'catalogue';
    } else if (shareRecordCategory === 'invoice') {
      refVal = `INV-${item.invoiceNo}`;
      cardTitle = `Invoice #${item.invoiceNo} — ₹${item.totalAmount || 0}`;
      scopeVal = 'billing';
    } else if (shareRecordCategory === 'complaint') {
      refVal = `CMP-${item.complaintNo || (item._id ? item._id.substring(0, 6) : 'REF')}`;
      cardTitle = `Complaint #${item.complaintNo || 'Ref'} — ${item.departmentName || 'General'}`;
      scopeVal = 'complain';
    }

    const actMeta = {
      action: 'SHARE_RECORD',
      module: shareRecordCategory === 'jobcard' ? 'Job Card' : shareRecordCategory === 'design' ? 'Design' : shareRecordCategory === 'invoice' ? 'Invoice' : 'Complaint',
      recordRef: refVal,
      recordId: item._id,
      permissionScope: scopeVal
    };

    const tempMsg = {
      _id: 'temp_' + Date.now(),
      roomId: targetRoomId,
      senderId: typeof currentUser === 'object' ? currentUser : { _id: myId, name: 'You' },
      content: cardTitle,
      createdAt: new Date().toISOString(),
      type: 'record-card',
      msgType: 'human',
      activityMeta: actMeta,
      recordMentions: [{ recordType: shareRecordCategory, recordRef: refVal }],
      readBy: [myId],
      isOptimistic: true
    };

    if (isCurrentRoom) {
      setMessages((prev) => [...prev, tempMsg]);
    }

    const messagePayload = {
      roomId: targetRoomId,
      senderId: myId,
      content: cardTitle,
      type: 'record-card',
      activityMeta: actMeta,
      recordMentions: [{ recordType: shareRecordCategory, recordRef: refVal }]
    };

    api.sendCommunicationMessage(targetRoomId, messagePayload)
      .then((res) => {
        if (res && res.success && res.data) {
          if (isCurrentRoom) {
            setMessages((prev) => prev.map((m) => (m._id === tempMsg._id ? res.data : m)));
          }
        }
        fetchGroups(false);
      })
      .catch((err) => {
        console.warn('HTTP share record card failed, falling back to socket emit:', err.message);
        if (socket) {
          socket.emit('send-message', messagePayload);
        }
        fetchGroups(false);
      });

    setShowShareModal(false);
  };

  // ── REACTION, PIN & EXPORT CHAT HANDLERS ──
  const handleToggleReaction = (messageId, emoji) => {
    const userId = currentUser?.id || currentUser?._id;
    setMessages((prev) =>
      prev.map((m) => {
        if (m._id !== messageId) return m;
        const currentReactions = { ...(m.reactions || {}) };
        const userList = currentReactions[emoji] || [];
        const uName = currentUser?.name || 'Staff';
        if (userList.includes(uName)) {
          currentReactions[emoji] = userList.filter((u) => u !== uName);
          if (currentReactions[emoji].length === 0) delete currentReactions[emoji];
        } else {
          currentReactions[emoji] = [...userList, uName];
        }
        return { ...m, reactions: currentReactions };
      })
    );
    if (socket && activeGroup) {
      socket.emit('toggle-reaction', { messageId, emoji, userId, roomId: activeGroup._id });
    }
  };

  const handleTogglePin = (messageId) => {
    if (socket && activeGroup) {
      socket.emit('toggle-pin-message', { messageId, roomId: activeGroup._id });
    }
  };

  const handleExportChatLog = () => {
    if (!messages || messages.length === 0) {
      alert('No messages in this channel to export.');
      return;
    }
    const channelName = activeGroup?.name || 'Chat_History';
    let textContent = `====================================================\n`;
    textContent += `ELITE EDITION — CHAT TRANSCRIPT FOR CHANNEL: ${channelName}\n`;
    textContent += `Exported At: ${new Date().toLocaleString()}\n`;
    textContent += `====================================================\n\n`;

    messages.forEach((m) => {
      const sender = typeof m.senderId === 'object' ? (m.senderId.name || m.senderId.username || 'User') : 'User';
      const timeStr = new Date(m.createdAt).toLocaleString();
      textContent += `[${timeStr}] ${sender}: ${m.content}\n`;
      if (m.attachment && m.attachment.fileUrl) {
        textContent += `   [Attachment: ${m.attachment.fileName} (${m.attachment.fileUrl})]\n`;
      }
    });

    const blob = new Blob([textContent], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${channelName.replace(/[^a-zA-Z0-9_-]/g, '_')}_chat_history.txt`;
    link.click();
    URL.revokeObjectURL(url);
  };


  // Floating WhatsApp Sticky Date Divider Helper
  const formatMessageDateHeader = (dateString) => {
    if (!dateString) return '';
    const d = new Date(dateString);
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);
    const msgDate = new Date(d.getFullYear(), d.getMonth(), d.getDate());

    if (msgDate.getTime() === today.getTime()) {
      return 'Today';
    }
    if (msgDate.getTime() === yesterday.getTime()) {
      return 'Yesterday';
    }
    return d.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' });
  };

  // Clipboard Screenshot Paste Handler
  const handlePasteClipboard = async (e) => {
    const items = e.clipboardData?.files;
    if (!items || items.length === 0) return;
    const file = items[0];
    if (file && file.type.startsWith('image/')) {
      e.preventDefault();
      try {
        const roomName = activeGroup?.name || 'General';
        const uploadRes = await api.uploadChatAttachment(file, roomName);
        if (uploadRes && uploadRes.fileUrl) {
          setAttachedFile({
            fileUrl: uploadRes.fileUrl,
            fileName: file.name || `clipboard_${Date.now()}.png`,
            fileType: 'image',
            fileSize: file.size
          });
        }
      } catch (err) {
        console.error('Failed to upload pasted image:', err);
        alert('Failed to attach pasted screenshot');
      }
    }
  };

  // Interactive Poll Voting Handler
  const handleVotePoll = async (messageId, optionId) => {
    const uId = currentUser?._id || currentUser?.id;
    if (!uId) return;

    try {
      const res = await api.votePollMessage(messageId, optionId);
      if (res.success && res.data) {
        setMessages((prev) =>
          prev.map((m) => (String(m._id) === String(messageId) ? res.data : m))
        );
      }
    } catch (err) {
      console.error('Failed to vote on poll:', err);
    }
  };

  // Submit New Interactive Poll
  const handleCreatePollSubmit = async (e) => {
    e.preventDefault();
    if (!pollQuestion.trim() || !activeGroup) return;
    const validOpts = pollOptions.filter((o) => o.trim().length > 0);
    if (validOpts.length < 2) {
      alert('Please enter at least 2 poll options.');
      return;
    }

    setSubmittingPoll(true);
    try {
      const formattedOptions = validOpts.map((opt, idx) => ({
        id: `opt_${idx + 1}_${Date.now()}`,
        text: opt.trim(),
        votes: []
      }));

      const pollMeta = {
        question: pollQuestion.trim(),
        options: formattedOptions,
        isMultiSelect: pollMultiSelect,
        isClosed: false
      };

      const res = await api.sendCommunicationMessage(activeGroup._id, {
        type: 'poll',
        content: `📊 Poll: ${pollQuestion.trim()}`,
        pollMeta
      });

      if (res.success && res.data) {
        setMessages((prev) => [...prev, res.data]);
        setShowPollModal(false);
        setPollQuestion('');
        setPollOptions(['', '']);
        setPollMultiSelect(false);
      }
    } catch (err) {
      alert('Failed to create poll: ' + err.message);
    } finally {
      setSubmittingPoll(false);
    }
  };

  // Cross-Room Message Forwarding Handlers
  const handleOpenForwardModal = (msg) => {
    setForwardTargetMsg(msg);
    setForwardTargetRoomId('');
    setShowForwardModal(true);
  };

  const handleSubmitForward = async () => {
    if (!forwardTargetMsg || !forwardTargetRoomId) {
      alert('Please select a target channel or DM.');
      return;
    }
    setForwardingMsg(true);
    try {
      const res = await api.forwardMessage(forwardTargetMsg._id, forwardTargetRoomId);
      if (res.success) {
        setShowForwardModal(false);
        alert('Message forwarded successfully!');
        if (String(activeGroup?._id) === String(forwardTargetRoomId)) {
          setMessages((prev) => [...prev, res.data]);
        }
      }
    } catch (err) {
      alert('Failed to forward message: ' + err.message);
    } finally {
      setForwardingMsg(false);
    }
  };

  // Infinite Scroll Handler for Older Messages
  const handleChatScroll = async () => {
    if (!chatScrollRef.current || loadingMoreMessages || !hasMoreMessages || !activeGroup) return;
    if (chatScrollRef.current.scrollTop === 0) {
      const nextPage = page + 1;
      setLoadingMoreMessages(true);
      const scrollHeightBefore = chatScrollRef.current.scrollHeight;

      try {
        const params = { page: nextPage, limit: 50 };
        if (msgFilter === 'human' || msgFilter === 'system_activity') params.msgType = msgFilter;

        const res = await api.getCommunicationMessages(activeGroup._id, params);
        if (res.success && res.data) {
          if (res.data.length < 50) setHasMoreMessages(false);
          setMessages((prev) => [...res.data, ...prev]);
          setPage(nextPage);

          setTimeout(() => {
            if (chatScrollRef.current) {
              chatScrollRef.current.scrollTop = chatScrollRef.current.scrollHeight - scrollHeightBefore;
            }
          }, 50);
        }
      } catch (err) {
        console.error('Failed to load older messages:', err);
      } finally {
        setLoadingMoreMessages(false);
      }
    }
  };

  // Admin Clear All Data Handler
  const handleClearAllData = async () => {
    setClearingData(true);
    try {
      const res = await api.clearAllCommunicationData();
      if (res.success) {
        setMessages([]);
        setShowClearAllModal(false);
        alert('All communication messages and test rooms cleared cleanly!');
        await fetchGroups(true);
      }
    } catch (err) {
      alert('Failed to clear data: ' + err.message);
    } finally {
      setClearingData(false);
    }
  };

  const handleSendMessage = async (e) => {
    e.preventDefault();
    if ((!inputMessage.trim() && !attachedFile) || !activeGroup) return;

    const senderId = currentUser?.id || currentUser?._id;
    if (!senderId) {
      alert('User session not loaded. Please log in again.');
      return;
    }

    const messageText = inputMessage.trim() || (attachedFile ? `Attached ${attachedFile.fileName}` : '');

    const messagePayload = {
      roomId: activeGroup._id,
      senderId,
      content: messageText,
      priority: isUrgent ? 'urgent' : 'normal',
      replyTo: replyToMessage ? replyToMessage._id : undefined,
      attachment: attachedFile || undefined,
    };

    const tempId = 'temp_' + Date.now();
    const tempMsg = {
      _id: tempId,
      roomId: activeGroup._id,
      senderId: typeof currentUser === 'object' ? currentUser : { _id: senderId, name: 'You' },
      content: messageText,
      createdAt: new Date().toISOString(),
      type: 'text',
      msgType: 'human',
      priority: isUrgent ? 'urgent' : 'normal',
      replyTo: replyToMessage || undefined,
      attachment: attachedFile || undefined,
      readBy: [senderId],
      isOptimistic: true
    };

    setMessages((prev) => [...prev, tempMsg]);

    setInputMessage('');
    setAttachedFile(null);
    setReplyToMessage(null);
    setIsUrgent(false);

    if (activeGroup?._id) {
      setRoomDrafts((prev) => {
        const copy = { ...prev };
        delete copy[activeGroup._id];
        return copy;
      });
    }

    try {
      const res = await api.sendCommunicationMessage(activeGroup._id, messagePayload);
      if (res && res.success && res.data) {
        const realMsg = res.data;
        setMessages((prev) => {
          const filtered = prev.filter((m) => m._id !== tempId && String(m._id) !== String(realMsg._id));
          return [...filtered, realMsg];
        });
      }
    } catch (err) {
      console.warn('HTTP post message failed, falling back to socket emit:', err.message);
      if (socket) {
        socket.emit('send-message', messagePayload);
      }
    }
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

  useEffect(() => {
    fetchGroups(true);
    fetchUsersForDMList();
  }, [currentUser]);

  const fetchUsersForDMList = async () => {
    try {
      const uId = currentUser?._id || currentUser?.id;
      const res = await api.getCommunicationUsers(uId);
      if (res.success && res.data) {
        setAllUsers(res.data);
      }
    } catch (err) {
      console.error('Failed to fetch users for DM list:', err);
    }
  };

  const getDMColleague = (group) => {
    if (!group || group.type !== 'direct' || !group.members || group.members.length === 0) return null;
    const myId = String(currentUser?._id || currentUser?.id || '');
    
    let otherMember = group.members.find((m) => {
      const memberId = String(typeof m === 'object' ? (m._id || m.id) : m);
      return memberId && memberId !== myId;
    });

    const otherId = String(typeof otherMember === 'object' ? (otherMember._id || otherMember.id) : (otherMember || ''));
    if (allUsers && allUsers.length > 0 && otherId && otherId !== myId) {
      const matched = allUsers.find((u) => String(u._id || u.id) === otherId);
      if (matched) return matched;
    }

    if (otherMember && typeof otherMember === 'object') {
      const oId = String(otherMember._id || otherMember.id || '');
      if (oId !== myId) return otherMember;
    }

    if (group.name && group.name.includes('&')) {
      const myName = currentUser?.name || currentUser?.username || '';
      const parts = group.name.split('&').map((s) => s.trim());
      const partnerName = parts.find((p) => !myName || !p.toLowerCase().includes(myName.toLowerCase()));
      if (partnerName) return { name: partnerName };
    }

    return null;
  };

  const handleRosterTabChange = (tab) => {
    setRosterTab(tab);
    if (tab === 'direct') {
      const dmRooms = groups.filter((g) => g.type === 'direct');
      if (dmRooms.length > 0) {
        if (!activeGroup || activeGroup.type !== 'direct') {
          setActiveGroup(dmRooms[0]);
        }
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

  const filteredGroups = useMemo(() => {
    const term = searchQuery.toLowerCase().trim();

    if (rosterTab === 'groups') {
      return groups.filter((g) => {
        if (g.type === 'direct') return false;
        if (!term) return true;
        return (
          (g.name || '').toLowerCase().includes(term) ||
          (g.department || '').toLowerCase().includes(term) ||
          (g.permissionScope || '').toLowerCase().includes(term)
        );
      });
    }

    if (rosterTab === 'direct') {
      const myId = String(currentUser?._id || currentUser?.id || '');
      const activeDmRooms = groups.filter((g) => g.type === 'direct');

      const existingDmUserIds = new Set();
      activeDmRooms.forEach((room) => {
        const colleague = getDMColleague(room);
        if (colleague) {
          const cId = String(colleague._id || colleague.id || '');
          if (cId) existingDmUserIds.add(cId);
        }
      });

      const contactUsers = (allUsers || []).filter((u) => {
        const uId = String(u._id || u.id || '');
        return uId && uId !== myId && !existingDmUserIds.has(uId);
      }).map((u) => ({
        _id: `contact_${u._id || u.id}`,
        isVirtualContact: true,
        user: u,
        name: u.name || u.username || u.email || 'Colleague',
        type: 'direct',
        department: u.department || 'General'
      }));

      const combined = [...activeDmRooms, ...contactUsers];

      if (!term) return combined;

      return combined.filter((item) => {
        if (item.isVirtualContact) {
          return (item.name || '').toLowerCase().includes(term) ||
                 (item.user?.department || '').toLowerCase().includes(term) ||
                 (item.user?.role || '').toLowerCase().includes(term);
        }
        const colleague = getDMColleague(item);
        const cName = colleague ? (colleague.name || colleague.username || '').toLowerCase() : (item.name || '').toLowerCase();
        return cName.includes(term);
      });
    }

    return groups;
  }, [groups, allUsers, rosterTab, searchQuery, currentUser]);

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
    if (scope.includes('jobcard') || scope.includes('job card')) onNavigateTab('jobcards');
    else if (scope.includes('catalogue') || scope.includes('design')) onNavigateTab('catalog');
    else if (scope.includes('billing') || scope.includes('invoice')) onNavigateTab('ee_invoices');
    else if (scope.includes('complain') || scope.includes('complaint')) onNavigateTab('ee_complaints');
    else if (scope.includes('fabric')) onNavigateTab('jobcards_fabric');
    else if (scope.includes('inventory')) onNavigateTab('inventory');
    else if (scope.includes('stitching')) onNavigateTab('jobcards_stitching_challan');
    else if (scope.includes('expense')) onNavigateTab('jobcards_expense');
    else onNavigateTab('jobcards');
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
      
      {/* ── TOP HEADER / ACTION BAR WITH PRIMARY TAB SWITCHER ── */}
      <div className="glass-panel" style={{ padding: '0.75rem 1.1rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderRadius: '14px', background: 'var(--bg-card)', flexWrap: 'wrap', gap: '0.75rem', border: '1px solid var(--border-light, #e2e8f0)', boxShadow: '0 4px 20px -2px rgba(0,0,0,0.05)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <div style={{ width: 40, height: 40, borderRadius: '11px', background: 'linear-gradient(135deg, #38bdf8 0%, #2563eb 100%)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', boxShadow: '0 4px 14px rgba(37,99,235,0.3)' }}>
            {mainTab === 'chat' ? <MessageSquare size={21} /> : <CheckSquare size={21} />}
          </div>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <h2 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 800, color: 'var(--text-primary)', letterSpacing: '-0.015em' }}>
                Inter-Department Communication &amp; Activity Stream
              </h2>
              <span style={{ fontSize: '0.62rem', fontWeight: 800, padding: '2px 7px', borderRadius: '10px', background: 'rgba(16,185,129,0.12)', color: '#10b981', border: '1px solid rgba(16,185,129,0.25)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                LIVE SYNC
              </span>
            </div>
            <p style={{ margin: '2px 0 0 0', fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 500 }}>
              {mainTab === 'chat'
                ? 'Group Channels, Direct Messages & Real-Time Activity Stream'
                : 'Task Management, Department Assignments & Progress Tracking'}
            </p>
          </div>
        </div>

        {/* 🌟 PRIMARY TAB SWITCHER: Chat | Tasks 🌟 */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '5px', background: 'var(--bg-input, #f1f5f9)', padding: '5px', borderRadius: '12px', border: '1px solid var(--border-light, #cbd5e1)' }}>
          <button
            type="button"
            onClick={() => { setMainTab('chat'); setRosterTab('groups'); }}
            style={{
              padding: '0.5rem 1.25rem',
              fontSize: '0.84rem',
              fontWeight: 800,
              borderRadius: '9px',
              border: 'none',
              background: mainTab === 'chat' ? 'linear-gradient(135deg, #38bdf8 0%, #2563eb 100%)' : 'transparent',
              color: mainTab === 'chat' ? '#ffffff' : 'var(--text-muted, #475569)',
              cursor: 'pointer',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.5rem',
              boxShadow: mainTab === 'chat' ? '0 3px 10px rgba(37,99,235,0.35)' : 'none',
              transition: 'all 0.18s ease',
              position: 'relative'
            }}
          >
            <MessageSquare size={16} />
            <span>Chat</span>
            {totalChatUnreadCount > 0 && (
              <span style={{
                background: '#ef4444',
                color: '#ffffff',
                fontSize: '0.65rem',
                fontWeight: 900,
                padding: '1px 6px',
                borderRadius: '10px',
                lineHeight: '1.2',
                boxShadow: '0 2px 5px rgba(239, 68, 68, 0.4)'
              }}>
                {totalChatUnreadCount > 99 ? '99+' : totalChatUnreadCount}
              </span>
            )}
          </button>

          <button
            type="button"
            onClick={() => { setMainTab('task'); }}
            style={{
              padding: '0.5rem 1.25rem',
              fontSize: '0.84rem',
              fontWeight: 800,
              borderRadius: '9px',
              border: 'none',
              background: mainTab === 'task' ? 'linear-gradient(135deg, #38bdf8 0%, #2563eb 100%)' : 'transparent',
              color: mainTab === 'task' ? '#ffffff' : 'var(--text-muted, #475569)',
              cursor: 'pointer',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.5rem',
              boxShadow: mainTab === 'task' ? '0 3px 10px rgba(37,99,235,0.35)' : 'none',
              transition: 'all 0.18s ease'
            }}
          >
            <CheckSquare size={16} />
            <span>Tasks</span>
          </button>
        </div>

        <div style={{ display: 'flex', gap: '0.55rem', alignItems: 'center' }}>
          {mainTab === 'chat' && currentUser?.role === 'admin' && (
            <button
              onClick={handleOpenCreateGroupModal}
              className="btn-primary"
              style={{ fontSize: '0.78rem', padding: '0.45rem 0.9rem', gap: '0.4rem', borderRadius: '9px', background: 'linear-gradient(135deg, #38bdf8 0%, #2563eb 100%)', fontWeight: 700 }}
              title="Create a new custom communication group with members"
            >
              <PlusCircle size={14} />
              <span>+ Create Group</span>
            </button>
          )}

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
            style={{ fontSize: '0.78rem', padding: '0.45rem 0.9rem', gap: '0.4rem', borderRadius: '9px', color: '#d97706', borderColor: '#f59e0b40', fontWeight: 700 }}
            title="Force clear cache & hard reload all connected users instantly"
          >
            <Zap size={13} color="#d97706" />
            <span>Hard Refresh All</span>
          </button>
        </div>
      </div>

      {/* ── MAIN CONTENT VIEW (IF TASK MODE SELECTED: FULL TASK PANEL | IF CHAT MODE: SPLIT ROSTER & STREAM) ── */}
      {mainTab === 'task' ? (
        <div style={{ flex: 1, minHeight: 0, overflow: 'hidden' }}>
          <TaskManagerPanel currentUser={currentUser} onNavigateTab={onNavigateTab} />
        </div>
      ) : (
      <div style={{ display: isMobileScreen ? 'flex' : 'grid', flexDirection: isMobileScreen ? 'column' : 'initial', gridTemplateColumns: isMobileScreen ? '1fr' : '290px 1fr', gap: '0.75rem', flex: 1, minHeight: 0, overflow: 'hidden' }}>
        
        {/* ════ LEFT COLUMN: GROUPS & DM ROSTER ════ */}
        <div className="glass-panel" style={{ display: (isMobileScreen && activeGroup && rosterTab !== 'tasks') ? 'none' : 'flex', flexDirection: 'column', height: '100%', borderRadius: '12px', overflow: 'hidden' }}>
          
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
              {groupUnreadCount > 0 && (
                <span style={{
                  background: rosterTab === 'groups' ? '#ffffff' : '#ef4444',
                  color: rosterTab === 'groups' ? '#2563eb' : '#ffffff',
                  fontSize: '0.62rem',
                  fontWeight: 900,
                  padding: '1px 5px',
                  borderRadius: '10px',
                  lineHeight: '1.2',
                  boxShadow: '0 1px 4px rgba(0,0,0,0.15)'
                }}>
                  {groupUnreadCount > 99 ? '99+' : groupUnreadCount}
                </span>
              )}
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
              {dmUnreadCount > 0 && (
                <span style={{
                  background: rosterTab === 'direct' ? '#ffffff' : '#ef4444',
                  color: rosterTab === 'direct' ? '#2563eb' : '#ffffff',
                  fontSize: '0.62rem',
                  fontWeight: 900,
                  padding: '1px 5px',
                  borderRadius: '10px',
                  lineHeight: '1.2',
                  boxShadow: '0 1px 4px rgba(0,0,0,0.15)'
                }}>
                  {dmUnreadCount > 99 ? '99+' : dmUnreadCount}
                </span>
              )}
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
                const isVirtual = group.isVirtualContact;
                const isActive = !isVirtual && activeGroup && String(activeGroup._id) === String(group._id);
                const isDirect = group.type === 'direct';
                const colleague = isDirect ? (isVirtual ? group.user : getDMColleague(group)) : null;
                const colleagueName = colleague ? (typeof colleague === 'object' ? (colleague.name || colleague.username || colleague.email) : group.name) : group.name;
                const displayName = isDirect ? (colleagueName || group.name || 'Private DM') : group.name;
                const deptCol = isDirect ? '#2563eb' : getDeptColor(group.department);

                return (
                  <div
                    key={group._id}
                    onClick={() => {
                      if (isVirtual && group.user) {
                        handleStartDirectChat(group.user);
                      } else {
                        handleSelectGroup(group);
                      }
                    }}
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
                          <span style={{
                            background: '#ef4444',
                            color: '#ffffff',
                            fontSize: '0.64rem',
                            fontWeight: 900,
                            padding: '1px 6px',
                            borderRadius: '10px',
                            minWidth: '18px',
                            height: '18px',
                            display: 'inline-flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            flexShrink: 0,
                            boxShadow: '0 2px 6px rgba(239, 68, 68, 0.45)',
                            border: '1px solid rgba(255, 255, 255, 0.4)'
                          }}>
                            {group.unreadCount > 99 ? '99+' : group.unreadCount}
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
        <div className="glass-panel" style={{ display: (isMobileScreen && !activeGroup && rosterTab !== 'tasks') ? 'none' : 'flex', flexDirection: 'column', height: '100%', borderRadius: '12px', overflow: 'hidden' }}>
          
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
                      {isMobileScreen && activeGroup && (
                        <button
                          onClick={() => setActiveGroup(null)}
                          style={{
                            background: '#eff6ff',
                            border: '1px solid #bfdbfe',
                            color: '#2563eb',
                            fontSize: '0.75rem',
                            fontWeight: 800,
                            padding: '0.35rem 0.65rem',
                            borderRadius: '6px',
                            cursor: 'pointer',
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '4px',
                            marginRight: '6px',
                            flexShrink: 0
                          }}
                          title="Back to conversation list"
                        >
                          ← Channels
                        </button>
                      )}
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

                      {/* In-Stream Search Toggle */}
                      <button
                        onClick={() => setShowInRoomSearch(!showInRoomSearch)}
                        className="btn-secondary"
                        style={{ fontSize: '0.75rem', padding: '0.35rem 0.65rem', gap: '0.35rem', borderRadius: '6px', background: showInRoomSearch ? 'rgba(56,189,248,0.15)' : undefined, borderColor: showInRoomSearch ? 'var(--primary)' : undefined }}
                        title="Search keywords inside this message stream"
                      >
                        <Search size={13} color={showInRoomSearch ? 'var(--primary)' : 'currentColor'} />
                        <span>Search</span>
                      </button>

                      {/* Audio Chime Mute/Unmute Toggle */}
                      <button
                        onClick={() => {
                          const next = !chatSoundMuted;
                          setChatSoundMuted(next);
                          if (typeof localStorage !== 'undefined') localStorage.setItem('elite_chat_sound_muted', String(next));
                        }}
                        className="btn-secondary"
                        style={{ fontSize: '0.75rem', padding: '0.35rem 0.65rem', borderRadius: '6px' }}
                        title={chatSoundMuted ? "Unmute Chat Sound Chimes" : "Mute Chat Sound Chimes"}
                      >
                        {chatSoundMuted ? <VolumeX size={13} color="#ef4444" /> : <Volume2 size={13} color="#10b981" />}
                      </button>

                      <button
                        onClick={() => setShowGalleryModal(true)}
                        className="btn-secondary"
                        style={{ fontSize: '0.75rem', padding: '0.35rem 0.65rem', gap: '0.35rem', borderRadius: '6px' }}
                        title="View Cloudflare R2 Media & Document Gallery for this room"
                      >
                        <Folder size={13} />
                        <span>Gallery</span>
                      </button>

                      <button
                        onClick={handleExportChatLog}
                        className="btn-secondary"
                        style={{ fontSize: '0.75rem', padding: '0.35rem 0.65rem', gap: '0.35rem', borderRadius: '6px' }}
                        title="Export chat transcript as a text file"
                      >
                        <FileText size={13} />
                        <span>Export</span>
                      </button>

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

              {/* In-Room Live Search Input Banner */}
              {showInRoomSearch && (
                <div style={{ padding: '0.5rem 1rem', background: 'var(--bg-card)', borderBottom: '1px solid var(--border-light)', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <Search size={14} color="var(--primary)" />
                  <input
                    type="text"
                    placeholder="Search keywords, record references, or staff names in this chat..."
                    value={inRoomQuery}
                    onChange={(e) => setInRoomQuery(e.target.value)}
                    style={{ flex: 1, border: '1px solid var(--border-light)', borderRadius: '6px', padding: '0.4rem 0.75rem', fontSize: '0.8rem', background: 'var(--bg-input)', color: 'var(--text-primary)', outline: 'none' }}
                    autoFocus
                  />
                  {inRoomQuery && (
                    <button onClick={() => setInRoomQuery('')} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', display: 'flex', alignItems: 'center' }}>
                      <X size={14} />
                    </button>
                  )}
                </div>
              )}

              {/* Pinned Messages Banner */}
              {messages.some((m) => m.isPinned) && (
                <div style={{ background: '#fef3c7', borderBottom: '1px solid #fde68a', padding: '0.45rem 1rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: '0.75rem', color: '#92400e', fontWeight: 700, flexShrink: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                    <Pin size={14} color="#d97706" />
                    <span>📌 Pinned Banner ({messages.filter((m) => m.isPinned).length}):</span>
                    <span style={{ fontWeight: 600, color: '#78350f' }}>
                      {messages.filter((m) => m.isPinned)[0]?.content?.substring(0, 75)}...
                    </span>
                  </div>
                  <button
                    onClick={() => setShowPinnedOnly(!showPinnedOnly)}
                    style={{ background: 'none', border: 'none', color: '#b45309', fontWeight: 800, cursor: 'pointer', fontSize: '0.72rem' }}
                  >
                    {showPinnedOnly ? 'Show All Messages' : 'View Pinned Only →'}
                  </button>
                </div>
              )}

              {/* Messages & Activity Stream Container */}
              <div
                ref={chatScrollRef}
                onScroll={handleChatScroll}
                style={{ flex: 1, overflowY: 'auto', padding: '1rem', display: 'flex', flexDirection: 'column', gap: '0.75rem', background: 'var(--bg-main)' }}
              >
                {loadingMoreMessages && (
                  <div style={{ textAlign: 'center', padding: '0.5rem', color: 'var(--text-muted)', fontSize: '0.75rem', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}>
                    <RefreshCw size={14} className="spin-loader" />
                    <span>Loading older messages...</span>
                  </div>
                )}

                {(() => {
                  let filteredList = showPinnedOnly ? messages.filter((m) => m.isPinned) : messages;
                  if (msgFilter === 'human') filteredList = filteredList.filter((m) => m.msgType !== 'system_activity');
                  if (msgFilter === 'system_activity') filteredList = filteredList.filter((m) => m.msgType === 'system_activity');
                  if (msgFilter === 'urgent') filteredList = filteredList.filter((m) => m.priority === 'urgent');
                  if (msgFilter === 'media') filteredList = filteredList.filter((m) => m.attachment);

                  if (inRoomQuery.trim()) {
                    const q = inRoomQuery.toLowerCase();
                    filteredList = filteredList.filter(
                      (m) =>
                        (m.content || '').toLowerCase().includes(q) ||
                        (m.senderName || m.senderId?.name || '').toLowerCase().includes(q) ||
                        (m.moduleName || '').toLowerCase().includes(q)
                    );
                  }

                  if (loadingMessages) {
                    return (
                      <div style={{ margin: 'auto', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.85rem' }}>
                        <RefreshCw size={20} className="spin-loader" style={{ marginBottom: '0.5rem' }} />
                        <div>Loading stream history...</div>
                      </div>
                    );
                  }

                  if (filteredList.length === 0) {
                    return (
                      <div style={{ margin: 'auto', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.85rem' }}>
                        <MessageSquare size={32} style={{ marginBottom: '0.5rem', opacity: 0.4 }} />
                        <div>{inRoomQuery ? `No messages found matching "${inRoomQuery}"` : 'No messages in this stream yet. Start the conversation below!'}</div>
                      </div>
                    );
                  }

                  let lastDateHeader = '';

                  return filteredList.map((msg) => {
                    const isMe = String(msg.senderId?._id || msg.senderId) === String(currentUser?.id || currentUser?._id);
                    const isSystemActivity = msg.msgType === 'system_activity';

                    // Compute Date Header
                    const msgDateHeader = formatMessageDateHeader(msg.createdAt);
                    const showDateHeader = msgDateHeader && msgDateHeader !== lastDateHeader;
                    if (showDateHeader) {
                      lastDateHeader = msgDateHeader;
                    }

                    if (isSystemActivity) {
                      const actBadge = getActionBadgeStyle(msg.actionType);
                      return (
                        <React.Fragment key={msg._id}>
                          {showDateHeader && (
                            <div style={{ display: 'flex', justifyContent: 'center', margin: '0.75rem 0', position: 'sticky', top: 0, zIndex: 10 }}>
                              <span style={{ padding: '0.25rem 0.75rem', borderRadius: '12px', fontSize: '0.68rem', fontWeight: 800, background: 'rgba(15,23,42,0.75)', color: '#e2e8f0', border: '1px solid rgba(255,255,255,0.15)', backdropFilter: 'blur(4px)', boxShadow: '0 2px 8px rgba(0,0,0,0.15)' }}>
                                {msgDateHeader}
                              </span>
                            </div>
                          )}

                          <div
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
                        </React.Fragment>
                      );
                    }

                    const isAudioMsg = msg.type === 'audio-voice' || (msg.attachment && msg.attachment.fileType === 'audio');
                    const isRecordCard = msg.type === 'record-card' || Boolean(msg.activityMeta && msg.activityMeta.module);
                    const isPollMsg = msg.type === 'poll' || Boolean(msg.pollMeta && msg.pollMeta.question);

                    return (
                      <React.Fragment key={msg._id}>
                        {showDateHeader && (
                          <div style={{ display: 'flex', justifyContent: 'center', margin: '0.75rem 0', position: 'sticky', top: 0, zIndex: 10 }}>
                            <span style={{ padding: '0.25rem 0.75rem', borderRadius: '12px', fontSize: '0.68rem', fontWeight: 800, background: 'rgba(15,23,42,0.75)', color: '#e2e8f0', border: '1px solid rgba(255,255,255,0.15)', backdropFilter: 'blur(4px)', boxShadow: '0 2px 8px rgba(0,0,0,0.15)' }}>
                              {msgDateHeader}
                            </span>
                          </div>
                        )}

                        <div
                          style={{
                            alignSelf: isMe ? 'flex-end' : 'flex-start',
                            maxWidth: '74%',
                            display: 'flex',
                            flexDirection: 'column',
                            alignItems: isMe ? 'flex-end' : 'flex-start'
                          }}
                        >
                          <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)', marginBottom: '2px', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '4px' }}>
                            <span>{msg.senderId?.name || msg.senderName || 'Staff Member'}</span>
                            <span>·</span>
                            <span>{formatTime(msg.createdAt)}</span>
                            {isMe && <CheckCheck size={13} color="#38bdf8" style={{ marginLeft: '2px' }} />}
                            {msg.priority === 'urgent' && (
                              <span style={{ color: '#ffffff', fontWeight: 800, background: '#ef4444', padding: '1px 5px', borderRadius: '4px', fontSize: '0.62rem', animation: 'pulse 1.5s infinite' }}>
                                🚨 URGENT SOS
                              </span>
                            )}
                            {msg.isPinned && (
                              <span style={{ color: '#d97706', fontWeight: 800, background: '#fef3c7', padding: '1px 4px', borderRadius: '3px', fontSize: '0.62rem' }}>
                                📌 PINNED
                              </span>
                            )}
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
                              wordBreak: 'break-word',
                              position: 'relative'
                            }}
                          >
                            {/* Forwarded Header */}
                            {msg.forwardedFrom && (
                              <div style={{ fontSize: '0.68rem', fontStyle: 'italic', fontWeight: 700, opacity: 0.9, display: 'flex', alignItems: 'center', gap: '4px', marginBottom: '4px', paddingBottom: '3px', borderBottom: isMe ? '1px solid rgba(255,255,255,0.2)' : '1px solid var(--border-light)' }}>
                                <CornerUpRight size={12} />
                                <span>Forwarded from {msg.forwardedFrom.senderName} ({msg.forwardedFrom.originalRoomName || 'Chat'})</span>
                              </div>
                            )}

                            {/* Quoted Reply Card */}
                            {msg.replyTo && (
                              <div style={{ background: isMe ? 'rgba(0,0,0,0.18)' : 'rgba(37,99,235,0.08)', borderRadius: '6px', borderLeft: isMe ? '3px solid #ffffff' : '3px solid #2563eb', padding: '4px 8px', marginBottom: '6px', fontSize: '0.74rem' }}>
                                <div style={{ fontWeight: 800, color: isMe ? '#ffffff' : '#2563eb', fontSize: '0.7rem' }}>
                                  {typeof msg.replyTo.senderId === 'object' ? (msg.replyTo.senderId.name || msg.replyTo.senderId.username) : 'Replying to staff'}
                                </div>
                                <div style={{ opacity: 0.9, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                  {msg.replyTo.content}
                                </div>
                              </div>
                            )}

                            {/* Interactive Poll Card */}
                            {isPollMsg && msg.pollMeta && (
                              <div style={{ minWidth: 240, maxWidth: 360, background: isMe ? 'rgba(255,255,255,0.12)' : 'var(--bg-main)', borderRadius: '10px', padding: '0.65rem 0.8rem', border: isMe ? '1px solid rgba(255,255,255,0.25)' : '1px solid var(--border-light)', marginBottom: '0.35rem' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '6px' }}>
                                  <BarChart2 size={16} color={isMe ? '#ffffff' : '#2563eb'} />
                                  <span style={{ fontSize: '0.85rem', fontWeight: 800 }}>{msg.pollMeta.question}</span>
                                </div>

                                {(() => {
                                  const totalVotes = msg.pollMeta.options.reduce((sum, o) => sum + (o.votes?.length || 0), 0);
                                  const uIdStr = String(currentUser?._id || currentUser?.id || '');

                                  return (
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.45rem', marginTop: '0.5rem' }}>
                                      {msg.pollMeta.options.map((opt) => {
                                        const voteCount = opt.votes ? opt.votes.length : 0;
                                        const pct = totalVotes > 0 ? Math.round((voteCount / totalVotes) * 100) : 0;
                                        const hasVoted = opt.votes && opt.votes.some((v) => String(typeof v === 'object' ? (v._id || v.id) : v) === uIdStr);

                                        return (
                                          <div
                                            key={opt.id}
                                            onClick={() => handleVotePoll(msg._id, opt.id)}
                                            style={{
                                              position: 'relative',
                                              padding: '0.45rem 0.65rem',
                                              borderRadius: '7px',
                                              background: isMe ? 'rgba(0,0,0,0.15)' : 'var(--bg-card)',
                                              border: hasVoted ? (isMe ? '1.5px solid #ffffff' : '1.5px solid #2563eb') : '1px solid var(--border-light)',
                                              cursor: 'pointer',
                                              overflow: 'hidden',
                                              transition: 'all 0.15s ease'
                                            }}
                                          >
                                            {/* Progress Bar Fill */}
                                            <div
                                              style={{
                                                position: 'absolute',
                                                left: 0,
                                                top: 0,
                                                bottom: 0,
                                                width: `${pct}%`,
                                                background: isMe ? 'rgba(255,255,255,0.25)' : 'rgba(37,99,235,0.15)',
                                                transition: 'width 0.3s ease'
                                              }}
                                            />

                                            <div style={{ position: 'relative', zIndex: 1, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                              <span style={{ fontSize: '0.78rem', fontWeight: hasVoted ? 800 : 600 }}>
                                                {hasVoted ? '✓ ' : ''}{opt.text}
                                              </span>
                                              <span style={{ fontSize: '0.7rem', fontWeight: 800, opacity: 0.9 }}>
                                                {pct}% ({voteCount})
                                              </span>
                                            </div>
                                          </div>
                                        );
                                      })}

                                      <div style={{ fontSize: '0.64rem', opacity: 0.8, marginTop: '2px', textAlign: 'right' }}>
                                        {totalVotes} total votes · {msg.pollMeta.isMultiSelect ? 'Multiple choice' : 'Single vote'}
                                      </div>
                                    </div>
                                  );
                                })()}
                              </div>
                            )}

                            {/* Audio Voice Player Card */}
                            {isAudioMsg && msg.attachment && msg.attachment.fileUrl && (
                              <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem', padding: '0.4rem 0.65rem', background: isMe ? 'rgba(255,255,255,0.2)' : 'rgba(37,99,235,0.08)', borderRadius: '10px', marginBottom: '0.35rem' }}>
                                <button
                                  type="button"
                                  onClick={() => {
                                    if (playingAudioId === msg._id) {
                                      setPlayingAudioId(null);
                                    } else {
                                      setPlayingAudioId(msg._id);
                                      const audio = new Audio(msg.attachment.fileUrl);
                                      audio.play();
                                      audio.onended = () => setPlayingAudioId(null);
                                    }
                                  }}
                                  style={{ background: isMe ? '#ffffff' : '#2563eb', color: isMe ? '#2563eb' : '#ffffff', border: 'none', width: 32, height: 32, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', flexShrink: 0, boxShadow: '0 2px 6px rgba(0,0,0,0.15)' }}
                                >
                                  {playingAudioId === msg._id ? <Pause size={15} /> : <Play size={15} />}
                                </button>

                                <div style={{ flex: 1 }}>
                                  <div style={{ fontSize: '0.76rem', fontWeight: 800, display: 'flex', alignItems: 'center', gap: '4px' }}>
                                    <Volume2 size={13} />
                                    <span>Voice Note</span>
                                  </div>
                                  <div style={{ fontSize: '0.66rem', opacity: 0.85 }}>
                                    {msg.attachment.durationSec || 5} sec · Cloudflare R2 Audio
                                  </div>
                                </div>
                              </div>
                            )}

                            {/* Quick Share Record Card */}
                            {isRecordCard && msg.activityMeta && msg.activityMeta.module && (
                              <div style={{ background: isMe ? 'rgba(255,255,255,0.15)' : 'var(--bg-main)', padding: '0.55rem 0.75rem', borderRadius: '8px', border: isMe ? '1px solid rgba(255,255,255,0.3)' : '1px solid var(--border-light)', marginBottom: '0.35rem' }}>
                                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '6px', marginBottom: '4px' }}>
                                  <span style={{ fontSize: '0.66rem', fontWeight: 800, color: isMe ? '#fff' : '#2563eb', textTransform: 'uppercase' }}>
                                    🃏 {msg.activityMeta.module}
                                  </span>
                                  <button
                                    type="button"
                                    onClick={() => handleRecordClick(msg.activityMeta)}
                                    style={{ background: isMe ? '#ffffff' : '#2563eb', color: isMe ? '#2563eb' : '#ffffff', border: 'none', padding: '2px 8px', borderRadius: '4px', fontSize: '0.68rem', fontWeight: 800, cursor: 'pointer' }}
                                  >
                                    Open →
                                  </button>
                                </div>
                                <div style={{ fontSize: '0.8rem', fontWeight: 800 }}>
                                  {msg.activityMeta.recordRef || msg.content}
                                </div>
                              </div>
                            )}

                            {/* Image Attachment */}
                            {msg.attachment && msg.attachment.fileUrl && !isAudioMsg && (
                              <div style={{ marginBottom: '0.4rem' }}>
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

                            {!isPollMsg && renderContentWithMentions(msg.content)}

                            {/* Reaction Badges */}
                            {msg.reactions && (
                              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '3px', marginTop: '5px' }}>
                                {Object.entries(
                                  Array.isArray(msg.reactions)
                                    ? msg.reactions.reduce((acc, r) => {
                                        acc[r.emoji] = (acc[r.emoji] || 0) + 1;
                                        return acc;
                                      }, {})
                                    : Object.fromEntries(Object.entries(msg.reactions).map(([e, users]) => [e, users.length]))
                                ).map(([emoji, count]) => (
                                  <span
                                    key={emoji}
                                    onClick={() => handleToggleReaction(msg._id, emoji)}
                                    style={{ fontSize: '0.7rem', background: isMe ? 'rgba(255,255,255,0.22)' : 'var(--bg-main)', border: isMe ? '1px solid rgba(255,255,255,0.3)' : '1px solid var(--border-light)', borderRadius: '10px', padding: '1px 6px', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: '3px' }}
                                  >
                                    <span>{emoji}</span>
                                    <span style={{ fontWeight: 800, fontSize: '0.64rem' }}>{count}</span>
                                  </span>
                                ))}
                              </div>
                            )}
                          </div>

                          {/* Hover Reaction Bar, Reply & Forward Buttons */}
                          <div style={{ display: 'flex', alignItems: 'center', gap: '4px', marginTop: '2px', opacity: 0.85 }}>
                            <div style={{ display: 'flex', gap: '2px', background: 'var(--bg-card)', padding: '1px 4px', borderRadius: '10px', border: '1px solid var(--border-light)' }}>
                              {['👍', '❤️', '🔥', '🎉', '✅'].map((emo) => (
                                <button
                                  key={emo}
                                  type="button"
                                  onClick={() => handleToggleReaction(msg._id, emo)}
                                  style={{ background: 'none', border: 'none', fontSize: '0.72rem', cursor: 'pointer', padding: '1px 3px' }}
                                >
                                  {emo}
                                </button>
                              ))}
                              
                              <button
                                type="button"
                                onClick={() => setReplyToMessage(msg)}
                                style={{ background: 'none', border: 'none', color: 'var(--primary)', cursor: 'pointer', padding: '1px 3px', display: 'flex', alignItems: 'center' }}
                                title="Reply to this message"
                              >
                                <Reply size={11} />
                              </button>

                              <button
                                type="button"
                                onClick={() => handleOpenForwardModal(msg)}
                                style={{ background: 'none', border: 'none', color: '#8b5cf6', cursor: 'pointer', padding: '1px 3px', display: 'flex', alignItems: 'center' }}
                                title="Forward message to another channel/DM"
                              >
                                <CornerUpRight size={11} />
                              </button>

                              <button
                                type="button"
                                onClick={() => handleTogglePin(msg._id)}
                                style={{ background: 'none', border: 'none', color: msg.isPinned ? '#d97706' : 'var(--text-muted)', cursor: 'pointer', padding: '1px 3px', display: 'flex', alignItems: 'center' }}
                                title={msg.isPinned ? 'Unpin message' : 'Pin message'}
                              >
                                {msg.isPinned ? <PinOff size={11} /> : <Pin size={11} />}
                              </button>
                            </div>

                            {/* Read Receipts Indicator */}
                            {isMe && (
                              <div style={{ fontSize: '0.65rem', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '2px', marginLeft: '4px' }}>
                                {msg.readBy && msg.readBy.length > 1 ? (
                                  <span style={{ color: '#2563eb', fontWeight: 800, display: 'inline-flex', alignItems: 'center', gap: '2px' }} title={`Read by ${msg.readBy.length - 1} team members`}>
                                    <CheckCheck size={13} />
                                    <span>Read</span>
                                  </span>
                                ) : (
                                  <span style={{ color: 'var(--text-muted)', display: 'inline-flex', alignItems: 'center', gap: '2px' }}>
                                    <Check size={12} />
                                    <span>Sent</span>
                                  </span>
                                )}
                              </div>
                            )}
                          </div>
                        </div>
                      </React.Fragment>
                    );
                  });
                })()}
                <div ref={chatBottomRef} />
              </div>

              {/* Quoted Inline Reply Banner */}
              {replyToMessage && (
                <div style={{ padding: '0.45rem 0.9rem', background: 'rgba(37,99,235,0.08)', borderTop: '1px solid #bfdbfe', borderLeft: '4px solid #2563eb', display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: '0.76rem', color: '#1d4ed8', fontWeight: 600 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', overflow: 'hidden' }}>
                    <Reply size={14} color="#2563eb" />
                    <div>
                      <span style={{ fontWeight: 800 }}>Replying to {typeof replyToMessage.senderId === 'object' ? (replyToMessage.senderId.name || replyToMessage.senderId.username) : 'Staff'}: </span>
                      <span style={{ opacity: 0.9, whiteSpace: 'nowrap', textOverflow: 'ellipsis' }}>{replyToMessage.content?.substring(0, 80)}</span>
                    </div>
                  </div>
                  <button onClick={() => setReplyToMessage(null)} style={{ background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer', display: 'flex', alignItems: 'center' }}>
                    <X size={14} />
                  </button>
                </div>
              )}

              {/* Attachment Preview Banner */}
              {attachedFile && (
                <div style={{ padding: '0.4rem 0.9rem', background: '#eff6ff', borderTop: '1px solid #bfdbfe', display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: '0.75rem', fontWeight: 700, color: '#1d4ed8' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                    <Paperclip size={14} color="#2563eb" />
                    <span>Attached ({attachedFile.fileType}): {attachedFile.fileName}</span>
                  </div>
                  <button onClick={() => setAttachedFile(null)} style={{ background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer' }}>
                    <X size={14} />
                  </button>
                </div>
              )}

              {/* Hidden File Input */}
              <input type="file" ref={fileInputRef} onChange={handleFileUpload} style={{ display: 'none' }} accept="image/*,.pdf,.doc,.docx,audio/*" />

              {/* Chat Input Form */}
              <form onSubmit={handleSendMessage} style={{ padding: '0.65rem 0.9rem', background: 'var(--bg-card)', borderTop: '1px solid var(--border-light)', display: 'flex', gap: '0.45rem', alignItems: 'center', flexShrink: 0 }}>
                {isRecordingAudio ? (
                  <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: '#fee2e2', border: '1px solid #fca5a5', padding: '0.4rem 0.8rem', borderRadius: '8px', color: '#b91c1c', fontWeight: 800, fontSize: '0.82rem' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                      <span style={{ width: 10, height: 10, borderRadius: '50%', background: '#ef4444' }} />
                      <span>Recording Voice Note... {String(Math.floor(recordingSeconds / 60)).padStart(2, '0')}:{String(recordingSeconds % 60).padStart(2, '0')}</span>
                    </div>
                    <div style={{ display: 'flex', gap: '0.4rem' }}>
                      <button type="button" onClick={cancelAudioRecording} style={{ background: 'none', border: 'none', color: '#dc2626', fontWeight: 700, cursor: 'pointer', fontSize: '0.78rem' }}>Cancel</button>
                      <button type="button" onClick={stopAudioRecording} style={{ background: '#ef4444', color: '#fff', border: 'none', padding: '0.25rem 0.75rem', borderRadius: '6px', fontWeight: 800, cursor: 'pointer', fontSize: '0.78rem' }}>Attach Audio →</button>
                    </div>
                  </div>
                ) : (
                  <>
                    {/* Audio Record Button */}
                    <button
                      type="button"
                      onClick={startAudioRecording}
                      style={{ background: 'none', border: 'none', color: '#2563eb', cursor: 'pointer', padding: '0.3rem', display: 'flex', alignItems: 'center' }}
                      title="Record Voice Note"
                    >
                      <Mic size={18} />
                    </button>

                    {/* Interactive Poll Button */}
                    <button
                      type="button"
                      onClick={() => setShowPollModal(true)}
                      style={{ background: 'none', border: 'none', color: '#10b981', cursor: 'pointer', padding: '0.3rem', display: 'flex', alignItems: 'center' }}
                      title="Create Department Poll & Vote"
                    >
                      <BarChart2 size={18} />
                    </button>

                    {/* Quick Share Record Button */}
                    <button
                      type="button"
                      onClick={() => handleOpenShareModal('jobcard')}
                      style={{ background: 'none', border: 'none', color: '#8b5cf6', cursor: 'pointer', padding: '0.3rem', display: 'flex', alignItems: 'center' }}
                      title="Share Job Card, Design, Invoice or Complaint Card"
                    >
                      <Share2 size={18} />
                    </button>

                    {/* Paperclip Button */}
                    <button
                      type="button"
                      onClick={() => fileInputRef.current && fileInputRef.current.click()}
                      style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', padding: '0.3rem', display: 'flex', alignItems: 'center' }}
                      title="Attach photo or document (up to 100MB Cloudflare R2)"
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
                      placeholder={`Message channel or paste screenshot (Cmd+V)...`}
                      value={inputMessage}
                      onPaste={handlePasteClipboard}
                      onChange={(e) => {
                        const val = e.target.value;
                        setInputMessage(val);
                        if (activeGroup?._id) {
                          setRoomDrafts((prev) => ({ ...prev, [activeGroup._id]: val }));
                        }
                      }}
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
                  </>
                )}
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
      )}

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

      {/* ── QUICK SHARE RECORD CARDS MODAL ── */}
      {showShareModal && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 9999, background: 'rgba(15, 23, 42, 0.65)', backdropFilter: 'blur(5px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem' }}>
          <div className="glass-panel" style={{ width: '100%', maxWidth: 540, borderRadius: '14px', overflow: 'hidden', display: 'flex', flexDirection: 'column', animation: 'slideUp 0.2s ease-out' }}>
            <div style={{ padding: '1rem 1.2rem', borderBottom: '1px solid var(--border-light)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'var(--bg-th)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <Share2 size={18} color="#8b5cf6" />
                <h3 style={{ margin: 0, fontSize: '0.95rem', fontWeight: 800, color: 'var(--text-primary)' }}>
                  Quick Share Record to Chat Stream
                </h3>
              </div>
              <button onClick={() => setShowShareModal(false)} className="btn-secondary" style={{ padding: '0.2rem 0.5rem', fontSize: '0.75rem', borderRadius: '6px' }}>
                Cancel
              </button>
            </div>

            {/* Category Switcher Pills */}
            <div style={{ padding: '0.6rem 1rem', borderBottom: '1px solid var(--border-light)', display: 'flex', gap: '0.4rem', background: 'var(--bg-main)' }}>
              {[
                { id: 'jobcard', label: '📋 Job Cards' },
                { id: 'design', label: '🎨 Designs' },
                { id: 'invoice', label: '🧾 Invoices' },
                { id: 'complaint', label: '⚠️ Complaints' },
              ].map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => {
                    setShareRecordCategory(tab.id);
                    fetchShareRecordItems(tab.id);
                  }}
                  style={{
                    flex: 1,
                    padding: '0.35rem 0.5rem',
                    fontSize: '0.75rem',
                    fontWeight: 800,
                    borderRadius: '6px',
                    border: shareRecordCategory === tab.id ? '1px solid #8b5cf6' : '1px solid var(--border-light)',
                    background: shareRecordCategory === tab.id ? '#8b5cf6' : 'var(--bg-card)',
                    color: shareRecordCategory === tab.id ? '#ffffff' : 'var(--text-primary)',
                    cursor: 'pointer',
                    transition: 'all 0.15s ease'
                  }}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            {/* 🏢 COMPANY SELECTION & 🚀 DIRECT SEND DESTINATION SELECTOR */}
            <div style={{
              padding: '0.65rem 1rem',
              background: 'rgba(139, 92, 246, 0.05)',
              borderBottom: '1px solid var(--border-light)',
              display: 'grid',
              gridTemplateColumns: isMobileScreen ? '1fr' : '1fr 1fr',
              gap: '0.65rem'
            }}>
              {/* Company Filter Dropdown */}
              <div>
                <label style={{ display: 'block', fontSize: '0.72rem', fontWeight: 800, color: 'var(--text-secondary)', marginBottom: '3px' }}>
                  🏢 Select Company:
                </label>
                <select
                  value={shareRecordCompany}
                  onChange={(e) => handleCompanyChangeInShareModal(e.target.value)}
                  style={{
                    width: '100%',
                    height: '32px',
                    padding: '0 0.5rem',
                    fontSize: '0.76rem',
                    fontWeight: 700,
                    borderRadius: '6px',
                    background: 'var(--bg-card)',
                    border: '1px solid var(--border-light)',
                    color: 'var(--text-primary)',
                    cursor: 'pointer'
                  }}
                >
                  <option value="">🏢 All Companies &amp; Depts</option>
                  <option value="Elite Digital Print">🖨️ Elite Digital Print (EDP)</option>
                  <option value="Elite Online">🛍️ Elite Online (EON)</option>
                  <option value="Elite Edition">🏢 Elite Edition (EE)</option>
                  <option value="Elite Fabtex">🧵 Elite Fabtex (EF)</option>
                  <option value="Elite Stitching">✂️ Elite Stitching (ES)</option>
                </select>
              </div>

              {/* Direct Send Target Channel Dropdown */}
              <div>
                <label style={{ display: 'block', fontSize: '0.72rem', fontWeight: 800, color: '#8b5cf6', marginBottom: '3px' }}>
                  🚀 Send Directly To:
                </label>
                <select
                  value={shareTargetRoomId}
                  onChange={(e) => setShareTargetRoomId(e.target.value)}
                  style={{
                    width: '100%',
                    height: '32px',
                    padding: '0 0.5rem',
                    fontSize: '0.76rem',
                    fontWeight: 700,
                    borderRadius: '6px',
                    background: 'var(--bg-card)',
                    border: '1.5px solid #8b5cf6',
                    color: 'var(--text-primary)',
                    cursor: 'pointer'
                  }}
                >
                  <option value={activeGroup?._id || ''}>📍 Current Chat ({activeGroup?.name || 'Active Room'})</option>
                  <optgroup label="🏢 Company Channels &amp; Groups">
                    {groups.filter((g) => g.type !== 'direct').map((g) => (
                      <option key={g._id} value={g._id}>
                        {g.name}
                      </option>
                    ))}
                  </optgroup>
                  {groups.some((g) => g.type === 'direct') && (
                    <optgroup label="💬 Direct Messages">
                      {groups.filter((g) => g.type === 'direct').map((g) => (
                        <option key={g._id} value={g._id}>
                          👤 {g.name}
                        </option>
                      ))}
                    </optgroup>
                  )}
                </select>
              </div>
            </div>

            <div style={{ padding: '0.75rem 1rem' }}>
              <div style={{ position: 'relative', marginBottom: '0.65rem' }}>
                <Search size={14} style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
                <input
                  type="text"
                  placeholder={`Search ${shareRecordCompany ? shareRecordCompany + ' ' : ''}${shareRecordCategory} records...`}
                  value={shareRecordSearch}
                  onChange={(e) => setShareRecordSearch(e.target.value)}
                  style={{ width: '100%', paddingLeft: '32px', fontSize: '0.8rem', height: '34px', background: 'var(--bg-input)', border: '1px solid var(--border-light)', borderRadius: '6px', boxSizing: 'border-box' }}
                />
              </div>

              <div style={{ maxHeight: '42vh', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                {loadingShareItems ? (
                  <div style={{ textAlign: 'center', padding: '1.5rem', color: 'var(--text-muted)' }}>
                    <RefreshCw size={18} className="spin-loader" />
                    <div style={{ fontSize: '0.78rem', marginTop: '0.4rem' }}>Loading records...</div>
                  </div>
                ) : shareRecordItems.length === 0 ? (
                  <div style={{ textAlign: 'center', padding: '1.5rem', color: 'var(--text-muted)', fontSize: '0.78rem' }}>
                    No records found for {shareRecordCategory}{shareRecordCompany ? ` (${shareRecordCompany})` : ''}{shareRecordSearch ? ` matching "${shareRecordSearch}"` : ''}.
                  </div>
                ) : (
                  shareRecordItems.map((item) => (
                    <div
                      key={item._id}
                      onClick={() => handleShareRecordToChat(item)}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        padding: '0.55rem 0.8rem',
                        borderRadius: '8px',
                        background: 'var(--bg-card)',
                        border: '1px solid var(--border-light)',
                        cursor: 'pointer',
                        transition: 'all 0.15s ease'
                      }}
                    >
                      <div style={{ flex: 1, minWidth: 0, paddingRight: '0.5rem' }}>
                        <div style={{ fontSize: '0.82rem', fontWeight: 800, color: 'var(--text-primary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                          {shareRecordCategory === 'jobcard' && `Job Card #${item.jobNo} — ${item.party || 'Client'}`}
                          {shareRecordCategory === 'design' && `Design: ${item.designName || item.designNo}`}
                          {shareRecordCategory === 'invoice' && `Invoice #${item.invoiceNo} — ₹${item.totalAmount || 0}`}
                          {shareRecordCategory === 'complaint' && `Complaint #${item.complaintNo || 'Ref'} — ${item.departmentName || 'General'}`}
                        </div>
                        <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginTop: '2px' }}>
                          {shareRecordCategory === 'jobcard' && `Design: ${item.designName || item.designNo || 'N/A'} · Fabric: ${item.fabric || 'N/A'} · Stage: ${item.productionStage || 'Order Received'}${item.totalMtr ? ' · ' + item.totalMtr + 'm' : ''}`}
                          {shareRecordCategory === 'design' && `Category: ${item.category || 'General'} · Fabric: ${item.fabricName || 'N/A'}`}
                          {shareRecordCategory === 'invoice' && `Party: ${item.customer?.name || item.partyName || 'Client'} · Date: ${item.invoiceDate || item.date || 'Recent'}`}
                          {shareRecordCategory === 'complaint' && `Status: ${item.status || 'Pending'} · Issue: ${item.issueType || item.category || 'General'}`}
                        </div>
                      </div>

                      <button
                        type="button"
                        className="btn-primary"
                        style={{ padding: '0.3rem 0.65rem', fontSize: '0.72rem', borderRadius: '6px', background: 'linear-gradient(135deg, #a855f7 0%, #7c3aed 100%)', flexShrink: 0 }}
                      >
                        {shareTargetRoomId && activeGroup && String(shareTargetRoomId) !== String(activeGroup._id) ? 'Send Direct →' : 'Share Card →'}
                      </button>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── SHARED MEDIA & DOCUMENT GALLERY MODAL ── */}
      {showGalleryModal && activeGroup && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 9999, background: 'rgba(15, 23, 42, 0.65)', backdropFilter: 'blur(5px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem' }}>
          <div className="glass-panel" style={{ width: '100%', maxWidth: 720, maxHeight: '85vh', borderRadius: '16px', overflow: 'hidden', display: 'flex', flexDirection: 'column', animation: 'slideUp 0.2s ease-out' }}>
            <div style={{ padding: '1rem 1.2rem', borderBottom: '1px solid var(--border-light)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'var(--bg-th)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <Folder size={18} color="#2563eb" />
                <h3 style={{ margin: 0, fontSize: '0.98rem', fontWeight: 800, color: 'var(--text-primary)' }}>
                  Cloudflare R2 Media & Document Gallery — {activeGroup.name}
                </h3>
              </div>
              <button onClick={() => setShowGalleryModal(false)} className="btn-secondary" style={{ padding: '0.2rem 0.5rem', fontSize: '0.75rem', borderRadius: '6px' }}>
                Close
              </button>
            </div>

            {/* Gallery Tabs */}
            <div style={{ padding: '0.5rem 1rem', borderBottom: '1px solid var(--border-light)', display: 'flex', gap: '0.4rem', background: 'var(--bg-main)' }}>
              {[
                { id: 'all', label: 'All Shared Files' },
                { id: 'image', label: '🖼️ Images' },
                { id: 'document', label: '📄 Documents / PDFs' },
                { id: 'audio', label: '🎙️ Voice Notes' },
              ].map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setGalleryTab(tab.id)}
                  style={{
                    padding: '0.35rem 0.65rem',
                    fontSize: '0.75rem',
                    fontWeight: 800,
                    borderRadius: '6px',
                    border: galleryTab === tab.id ? '1px solid #2563eb' : '1px solid var(--border-light)',
                    background: galleryTab === tab.id ? '#2563eb' : 'var(--bg-card)',
                    color: galleryTab === tab.id ? '#ffffff' : 'var(--text-primary)',
                    cursor: 'pointer'
                  }}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            {/* Gallery Grid */}
            <div style={{ padding: '1rem', overflowY: 'auto', flex: 1 }}>
              {(() => {
                const attachedMsgs = messages.filter((m) => {
                  if (!m.attachment || !m.attachment.fileUrl) return false;
                  if (galleryTab === 'all') return true;
                  if (galleryTab === 'image') return m.attachment.fileType === 'image';
                  if (galleryTab === 'document') return m.attachment.fileType === 'document' || m.attachment.fileType === 'pdf';
                  if (galleryTab === 'audio') return m.type === 'audio-voice' || m.attachment.fileType === 'audio';
                  return true;
                });

                if (attachedMsgs.length === 0) {
                  return (
                    <div style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-muted)', fontSize: '0.85rem' }}>
                      <Folder size={36} style={{ marginBottom: '0.5rem', opacity: 0.4 }} />
                      <div>No files or media found for category "{galleryTab}".</div>
                    </div>
                  );
                }

                return (
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: '0.75rem' }}>
                    {attachedMsgs.map((m) => {
                      const att = m.attachment;
                      const isImg = att.fileType === 'image';
                      const isAudio = m.type === 'audio-voice' || att.fileType === 'audio';

                      return (
                        <div
                          key={m._id}
                          style={{
                            borderRadius: '10px',
                            border: '1px solid var(--border-light)',
                            background: 'var(--bg-card)',
                            overflow: 'hidden',
                            display: 'flex',
                            flexDirection: 'column'
                          }}
                        >
                          {isImg ? (
                            <img
                              src={att.fileUrl}
                              alt={att.fileName}
                              onClick={() => setZoomImg(att.fileUrl)}
                              style={{ width: '100%', height: '110px', objectFit: 'cover', cursor: 'zoom-in' }}
                            />
                          ) : (
                            <div style={{ height: '110px', background: isAudio ? '#eff6ff' : '#f8fafc', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '0.5rem', textContent: 'center' }}>
                              {isAudio ? <Volume2 size={28} color="#2563eb" /> : <FileText size={28} color="#64748b" />}
                              <span style={{ fontSize: '0.68rem', fontWeight: 800, color: 'var(--text-primary)', marginTop: '4px', textAlign: 'center', wordBreak: 'break-all' }}>
                                {att.fileName || 'File'}
                              </span>
                            </div>
                          )}

                          <div style={{ padding: '0.5rem 0.65rem', flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
                            <div>
                              <div style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                {att.fileName}
                              </div>
                              <div style={{ fontSize: '0.65rem', color: 'var(--text-muted)', marginTop: '2px' }}>
                                Shared by: {m.senderId?.name || 'Staff'} · {formatDateLabel(m.createdAt)}
                              </div>
                            </div>

                            <div style={{ marginTop: '0.4rem', display: 'flex', gap: '0.4rem' }}>
                              <a
                                href={att.fileUrl}
                                download={att.fileName}
                                className="btn-primary"
                                style={{ flex: 1, padding: '0.25rem', fontSize: '0.68rem', textAlign: 'center', textDecoration: 'none', borderRadius: '4px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                              >
                                Download
                              </a>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                );
              })()}
            </div>
          </div>
        </div>
      )}

      {/* ── CREATE POLL MODAL ── */}
      {showPollModal && activeGroup && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 9999, background: 'rgba(15, 23, 42, 0.65)', backdropFilter: 'blur(5px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem' }}>
          <div className="glass-panel" style={{ width: '100%', maxWidth: 500, borderRadius: '16px', overflow: 'hidden', display: 'flex', flexDirection: 'column', animation: 'slideUp 0.2s ease-out' }}>
            <div style={{ padding: '1rem 1.2rem', borderBottom: '1px solid var(--border-light)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'var(--bg-th)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <BarChart2 size={18} color="#10b981" />
                <h3 style={{ margin: 0, fontSize: '0.95rem', fontWeight: 800, color: 'var(--text-primary)' }}>
                  Create Department Poll &amp; Voting
                </h3>
              </div>
              <button onClick={() => setShowPollModal(false)} className="btn-secondary" style={{ padding: '0.2rem 0.5rem', fontSize: '0.75rem', borderRadius: '6px' }}>
                Cancel
              </button>
            </div>

            <form onSubmit={handleCreatePollSubmit} style={{ padding: '1.2rem', display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '4px' }}>
                  Poll Question *
                </label>
                <input
                  type="text"
                  placeholder="e.g. Which shift should run the high-speed printing machine today?"
                  value={pollQuestion}
                  onChange={(e) => setPollQuestion(e.target.value)}
                  style={{ width: '100%', padding: '0.55rem 0.8rem', fontSize: '0.84rem', borderRadius: '8px', border: '1px solid var(--border-light)', background: 'var(--bg-input)', color: 'var(--text-primary)', boxSizing: 'border-box' }}
                  required
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '6px' }}>
                  Poll Options (At least 2 required)
                </label>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.45rem' }}>
                  {pollOptions.map((opt, idx) => (
                    <div key={idx} style={{ display: 'flex', gap: '0.4rem', alignItems: 'center' }}>
                      <input
                        type="text"
                        placeholder={`Option ${idx + 1}`}
                        value={opt}
                        onChange={(e) => {
                          const copy = [...pollOptions];
                          copy[idx] = e.target.value;
                          setPollOptions(copy);
                        }}
                        style={{ flex: 1, padding: '0.45rem 0.75rem', fontSize: '0.8rem', borderRadius: '6px', border: '1px solid var(--border-light)', background: 'var(--bg-input)', color: 'var(--text-primary)' }}
                        required={idx < 2}
                      />
                      {pollOptions.length > 2 && (
                        <button
                          type="button"
                          onClick={() => setPollOptions(pollOptions.filter((_, i) => i !== idx))}
                          style={{ background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer', padding: '4px' }}
                        >
                          <X size={14} />
                        </button>
                      )}
                    </div>
                  ))}
                </div>

                <button
                  type="button"
                  onClick={() => setPollOptions([...pollOptions, ''])}
                  style={{ marginTop: '0.5rem', background: 'none', border: 'none', color: '#2563eb', fontSize: '0.75rem', fontWeight: 800, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: '3px' }}
                >
                  <Plus size={14} />
                  <span>+ Add Option</span>
                </button>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', background: 'var(--bg-main)', padding: '0.6rem 0.8rem', borderRadius: '8px', border: '1px solid var(--border-light)' }}>
                <input
                  type="checkbox"
                  id="pollMultiSelect"
                  checked={pollMultiSelect}
                  onChange={(e) => setPollMultiSelect(e.target.checked)}
                  style={{ cursor: 'pointer' }}
                />
                <label htmlFor="pollMultiSelect" style={{ fontSize: '0.78rem', fontWeight: 600, color: 'var(--text-primary)', cursor: 'pointer' }}>
                  Allow voters to select multiple options
                </label>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem', marginTop: '0.4rem' }}>
                <button
                  type="button"
                  onClick={() => setShowPollModal(false)}
                  className="btn-secondary"
                  style={{ fontSize: '0.8rem', padding: '0.45rem 0.9rem', borderRadius: '8px' }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submittingPoll}
                  className="btn-primary"
                  style={{ fontSize: '0.8rem', padding: '0.45rem 1.1rem', borderRadius: '8px', background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)' }}
                >
                  {submittingPoll ? 'Publishing Poll...' : 'Publish Poll →'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── CROSS-ROOM FORWARD MESSAGE MODAL ── */}
      {showForwardModal && forwardTargetMsg && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 9999, background: 'rgba(15, 23, 42, 0.65)', backdropFilter: 'blur(5px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem' }}>
          <div className="glass-panel" style={{ width: '100%', maxWidth: 460, borderRadius: '16px', overflow: 'hidden', display: 'flex', flexDirection: 'column', animation: 'slideUp 0.2s ease-out' }}>
            <div style={{ padding: '1rem 1.2rem', borderBottom: '1px solid var(--border-light)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'var(--bg-th)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <CornerUpRight size={18} color="#8b5cf6" />
                <h3 style={{ margin: 0, fontSize: '0.95rem', fontWeight: 800, color: 'var(--text-primary)' }}>
                  Forward Message
                </h3>
              </div>
              <button onClick={() => setShowForwardModal(false)} className="btn-secondary" style={{ padding: '0.2rem 0.5rem', fontSize: '0.75rem', borderRadius: '6px' }}>
                Cancel
              </button>
            </div>

            <div style={{ padding: '1.2rem', display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
              <div style={{ background: 'var(--bg-main)', padding: '0.6rem 0.8rem', borderRadius: '8px', borderLeft: '3.5px solid #8b5cf6', fontSize: '0.78rem' }}>
                <div style={{ fontWeight: 800, color: '#8b5cf6', marginBottom: '2px' }}>
                  Original Message ({typeof forwardTargetMsg.senderId === 'object' ? (forwardTargetMsg.senderId.name || forwardTargetMsg.senderId.username) : 'Staff'}):
                </div>
                <div style={{ color: 'var(--text-primary)', lineHeight: 1.35 }}>
                  {forwardTargetMsg.content}
                </div>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '4px' }}>
                  Select Target Channel / DM *
                </label>
                <select
                  value={forwardTargetRoomId}
                  onChange={(e) => setForwardTargetRoomId(e.target.value)}
                  style={{ width: '100%', padding: '0.55rem 0.8rem', fontSize: '0.82rem', borderRadius: '8px', border: '1px solid var(--border-light)', background: 'var(--bg-input)', color: 'var(--text-primary)' }}
                >
                  <option value="">-- Choose Channel or DM Room --</option>
                  {groups.map((g) => (
                    <option key={g._id} value={g._id}>
                      {g.type === 'direct' ? `💬 DM: ${g.name}` : `🏢 Group: ${g.name} (${g.department})`}
                    </option>
                  ))}
                </select>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem', marginTop: '0.4rem' }}>
                <button
                  type="button"
                  onClick={() => setShowForwardModal(false)}
                  className="btn-secondary"
                  style={{ fontSize: '0.8rem', padding: '0.45rem 0.9rem', borderRadius: '8px' }}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleSubmitForward}
                  disabled={forwardingMsg || !forwardTargetRoomId}
                  className="btn-primary"
                  style={{ fontSize: '0.8rem', padding: '0.45rem 1.1rem', borderRadius: '8px', background: 'linear-gradient(135deg, #a855f7 0%, #7c3aed 100%)', opacity: !forwardTargetRoomId ? 0.6 : 1 }}
                >
                  {forwardingMsg ? 'Forwarding...' : 'Forward Message →'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── ADMIN CLEAN SLATE DATA RESET MODAL ── */}
      {showClearAllModal && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 9999, background: 'rgba(15, 23, 42, 0.75)', backdropFilter: 'blur(5px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem' }}>
          <div className="glass-panel" style={{ width: '100%', maxWidth: 460, borderRadius: '16px', overflow: 'hidden', display: 'flex', flexDirection: 'column', animation: 'slideUp 0.2s ease-out', border: '1.5px solid #fca5a5' }}>
            <div style={{ padding: '1rem 1.2rem', borderBottom: '1px solid #fee2e2', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#fef2f2' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <Trash2 size={18} color="#dc2626" />
                <h3 style={{ margin: 0, fontSize: '0.98rem', fontWeight: 800, color: '#991b1b' }}>
                  Clean Slate: Clear All Communication Data
                </h3>
              </div>
              <button onClick={() => setShowClearAllModal(false)} className="btn-secondary" style={{ padding: '0.2rem 0.5rem', fontSize: '0.75rem', borderRadius: '6px' }}>
                Cancel
              </button>
            </div>

            <div style={{ padding: '1.2rem', display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
              <p style={{ margin: 0, fontSize: '0.84rem', color: '#7f1d1d', lineHeight: 1.45, fontWeight: 600 }}>
                Are you sure you want to delete ALL chat messages across all channels and direct messages, and reset department groups to default authority rooms?
              </p>
              <div style={{ fontSize: '0.75rem', color: '#b91c1c', background: '#fee2e2', padding: '0.6rem 0.8rem', borderRadius: '8px', border: '1px solid #fca5a5' }}>
                ⚠️ <strong>WARNING:</strong> This action is permanent. All test history will be deleted and connected clients will reset their stream immediately.
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem', marginTop: '0.4rem' }}>
                <button
                  type="button"
                  onClick={() => setShowClearAllModal(false)}
                  className="btn-secondary"
                  style={{ fontSize: '0.8rem', padding: '0.45rem 0.9rem', borderRadius: '8px' }}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleClearAllData}
                  disabled={clearingData}
                  className="btn-primary"
                  style={{ fontSize: '0.8rem', padding: '0.45rem 1.1rem', borderRadius: '8px', background: '#dc2626', color: '#fff' }}
                >
                  {clearingData ? 'Deleting Data...' : 'Yes, Delete All Data & Reset'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
