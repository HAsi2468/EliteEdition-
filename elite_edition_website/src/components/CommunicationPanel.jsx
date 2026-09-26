import React, { useState, useEffect, useRef, useMemo } from 'react';
import { api, getBaseUrl } from '../services/api';
import { useSocket } from '../contexts/SocketContext';
import TaskManagerPanel from './TaskManagerPanel';
import JobCardPdfModal from './JobCardPdfModal';
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
  ChevronLeft,
  MoreVertical,
  Phone,
  PhoneOff,
  Video,
  VideoOff,
  MicOff,
  Monitor,
  MonitorOff,
  PhoneIncoming,
  Grid,
  MoreHorizontal,
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
  CornerUpRight,
  ChevronDown,
  Calendar
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
  const [rosterTab, setRosterTab] = useState('all'); // 'all' | 'groups' | 'direct'
  const [phoenixFilter, setPhoenixFilter] = useState('all'); // 'all' | 'read' | 'unread'
  const [isUrgent, setIsUrgent] = useState(false);
  const [attachedFile, setAttachedFile] = useState(null);
  const [zoomImg, setZoomImg] = useState(null);
  const [showInRoomSearch, setShowInRoomSearch] = useState(false);
  const [inRoomQuery, setInRoomQuery] = useState('');
  const [showPinnedOnly, setShowPinnedOnly] = useState(false);
  const [chatSoundMuted, setChatSoundMuted] = useState(() => typeof localStorage !== 'undefined' ? localStorage.getItem('elite_chat_sound_muted') === 'true' : false);
  const [playingAudioId, setPlayingAudioId] = useState(null);
  const [activeMsgMenuId, setActiveMsgMenuId] = useState(null);
  const [isMobileScreen, setIsMobileScreen] = useState(() => typeof window !== 'undefined' && window.innerWidth < 768);
  const [viewportHeight, setViewportHeight] = useState(null);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    const handleResize = () => {
      const isMob = window.innerWidth < 768;
      setIsMobileScreen(isMob);
      if (isMob) {
        const vv = window.visualViewport;
        setViewportHeight(vv ? vv.height : window.innerHeight);
      } else {
        setViewportHeight(null);
      }
    };

    handleResize();
    window.addEventListener('resize', handleResize);
    if (window.visualViewport) {
      window.visualViewport.addEventListener('resize', handleResize);
      window.visualViewport.addEventListener('scroll', handleResize);
    }
    return () => {
      window.removeEventListener('resize', handleResize);
      if (window.visualViewport) {
        window.visualViewport.removeEventListener('resize', handleResize);
        window.visualViewport.removeEventListener('scroll', handleResize);
      }
    };
  }, []);

  const [showMobileActionMenu, setShowMobileActionMenu] = useState(false);
  const [showMobileHeaderMenu, setShowMobileHeaderMenu] = useState(false);
  const [showDesktopHeaderMenu, setShowDesktopHeaderMenu] = useState(false);

  // ─── Real-Time Voice & Video Calling Suite State ───
  const [activeCall, setActiveCall] = useState(null); // { type: 'voice' | 'video', recipientName, recipientAvatar, status: 'calling' | 'connected' | 'ended', isMuted: false, isVideoOff: false, isSpeakerOn: true, isScreenSharing: false, error: null }
  const [incomingCall, setIncomingCall] = useState(null);
  const [callDuration, setCallDuration] = useState(0);
  const [showDialpad, setShowDialpad] = useState(false);
  const [dialpadDigits, setDialpadDigits] = useState('');
  const [audioLevel, setAudioLevel] = useState(0);

  const localVideoRef = useRef(null);
  const localStreamRef = useRef(null);
  const screenStreamRef = useRef(null);
  const callTimerRef = useRef(null);
  const audioContextRef = useRef(null);
  const audioIntervalRef = useRef(null);

  // Job Card PDF preview modal state
  const [pdfPreviewCard, setPdfPreviewCard] = useState(null);
  const [pdfPreviewLoading, setPdfPreviewLoading] = useState(false);
  const [pdfPreviewError, setPdfPreviewError] = useState('');

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
  const autoSendRef = useRef(false);
  const isPushToTalkRef = useRef(false);
  const recordingStartTimeRef = useRef(0);
  const touchStartYRef = useRef(null);
  const isCancelGestureRef = useRef(false);
  const [slideCancelActive, setSlideCancelActive] = useState(false);
  const activeGroupRef = useRef(activeGroup);
  const currentUserRef = useRef(currentUser);

  useEffect(() => {
    activeGroupRef.current = activeGroup;
  }, [activeGroup]);

  useEffect(() => {
    currentUserRef.current = currentUser;
  }, [currentUser]);

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

  // Direct In-Chat Task Creation State
  const [showChatTaskModal, setShowChatTaskModal] = useState(false);
  const [chatTaskForm, setChatTaskForm] = useState({
    title: '',
    description: '',
    priority: 'medium',
    dueDate: '',
    assignees: [],
    projectRef: '',
    clientName: ''
  });
  const [staffUsers, setStaffUsers] = useState([]);
  const [isCreatingChatTask, setIsCreatingChatTask] = useState(false);

  useEffect(() => {
    api.getUsers({ limit: 100 })
      .then(res => {
        const uList = Array.isArray(res) ? res : (res?.data || res?.results || []);
        if (Array.isArray(uList)) setStaffUsers(uList);
      })
      .catch(err => console.warn('Could not load staff users for chat task creation:', err));
  }, []);

  // ─── Real-Time Voice & Video Calling Handlers ───
  const formatDuration = (secs) => {
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  };

  const startCall = async (type = 'voice') => {
    if (!activeGroup) return;
    const recipient = activeGroup.displayName || activeGroup.name || 'Team Member';
    const recipientAvatar = activeGroup.avatar || null;

    setActiveCall({
      type,
      recipientName: recipient,
      recipientAvatar,
      status: 'calling',
      isMuted: false,
      isVideoOff: false,
      isSpeakerOn: true,
      isScreenSharing: false,
      error: null
    });
    setCallDuration(0);
    setShowDialpad(false);
    setDialpadDigits('');

    // Emit socket call event
    if (socket && activeGroup._id) {
      socket.emit('call-user', {
        roomId: activeGroup._id,
        callType: type,
        caller: currentUser?._id || currentUser?.id,
        callerName: currentUser?.name || currentUser?.username || 'Elite User'
      });
    }

    // Capture local audio/video media
    try {
      if (typeof navigator !== 'undefined' && navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
        const constraints = type === 'video' ? { audio: true, video: true } : { audio: true, video: false };
        let stream = null;
        try {
          stream = await navigator.mediaDevices.getUserMedia(constraints);
        } catch (mediaErr) {
          console.warn('Initial getUserMedia capture failed, trying audio only fallback:', mediaErr);
          try {
            stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
          } catch (audioErr) {
            console.warn('Audio capture also failed:', audioErr);
          }
        }

        if (stream) {
          localStreamRef.current = stream;
          if (localVideoRef.current && type === 'video') {
            localVideoRef.current.srcObject = stream;
          }

          // Setup AudioContext for waveform / pulse visualizer
          try {
            const AudioCtx = window.AudioContext || window.webkitAudioContext;
            if (AudioCtx) {
              const ctx = new AudioCtx();
              audioContextRef.current = ctx;
              const source = ctx.createMediaStreamSource(stream);
              const analyser = ctx.createAnalyser();
              analyser.fftSize = 64;
              source.connect(analyser);
              const dataArray = new Uint8Array(analyser.frequencyBinCount);

              audioIntervalRef.current = setInterval(() => {
                analyser.getByteFrequencyData(dataArray);
                let sum = 0;
                for (let i = 0; i < dataArray.length; i++) sum += dataArray[i];
                const avg = sum / (dataArray.length || 1);
                setAudioLevel(Math.min(100, Math.round((avg / 255) * 100)));
              }, 120);
            }
          } catch (visErr) {
            console.warn('Visualization setup warning:', visErr);
          }
        }
      }
    } catch (err) {
      console.warn('getUserMedia uncaught error:', err);
    }

    // Transition to connected after brief ring if other end is auto-joining room
    setTimeout(() => {
      setActiveCall((prev) => {
        if (prev && prev.status === 'calling') {
          return { ...prev, status: 'connected' };
        }
        return prev;
      });
    }, 2400);
  };

  const endCall = (shouldEmit = true) => {
    if (shouldEmit && socket && activeGroup?._id) {
      socket.emit('end-call', {
        roomId: activeGroup._id,
        from: currentUser?._id || currentUser?.id
      });
    }

    if (localStreamRef.current) {
      try {
        localStreamRef.current.getTracks().forEach((t) => t.stop());
      } catch (e) {}
      localStreamRef.current = null;
    }
    if (screenStreamRef.current) {
      try {
        screenStreamRef.current.getTracks().forEach((t) => t.stop());
      } catch (e) {}
      screenStreamRef.current = null;
    }
    if (audioIntervalRef.current) {
      clearInterval(audioIntervalRef.current);
      audioIntervalRef.current = null;
    }
    if (audioContextRef.current) {
      try {
        audioContextRef.current.close();
      } catch (e) {}
      audioContextRef.current = null;
    }
    if (callTimerRef.current) {
      clearInterval(callTimerRef.current);
      callTimerRef.current = null;
    }

    setAudioLevel(0);
    setActiveCall((prev) => (prev ? { ...prev, status: 'ended' } : null));
    setTimeout(() => {
      setActiveCall(null);
      setCallDuration(0);
      setShowDialpad(false);
      setDialpadDigits('');
    }, 1000);
  };

  const toggleMute = () => {
    setActiveCall((prev) => {
      if (!prev) return null;
      const nextMuted = !prev.isMuted;
      if (localStreamRef.current) {
        localStreamRef.current.getAudioTracks().forEach((t) => {
          t.enabled = !nextMuted;
        });
      }
      return { ...prev, isMuted: nextMuted };
    });
  };

  const toggleVideo = () => {
    setActiveCall((prev) => {
      if (!prev) return null;
      const nextVideoOff = !prev.isVideoOff;
      if (localStreamRef.current) {
        localStreamRef.current.getVideoTracks().forEach((t) => {
          t.enabled = !nextVideoOff;
        });
      }
      return { ...prev, isVideoOff: nextVideoOff };
    });
  };

  const toggleScreenShare = async () => {
    if (!activeCall) return;
    if (activeCall.isScreenSharing) {
      if (screenStreamRef.current) {
        try {
          screenStreamRef.current.getTracks().forEach((t) => t.stop());
        } catch (e) {}
        screenStreamRef.current = null;
      }
      if (localVideoRef.current && localStreamRef.current) {
        localVideoRef.current.srcObject = localStreamRef.current;
      }
      setActiveCall((prev) => ({ ...prev, isScreenSharing: false }));
    } else {
      try {
        if (typeof navigator !== 'undefined' && navigator.mediaDevices && navigator.mediaDevices.getDisplayMedia) {
          const screenStream = await navigator.mediaDevices.getDisplayMedia({ video: true });
          screenStreamRef.current = screenStream;
          if (localVideoRef.current) {
            localVideoRef.current.srcObject = screenStream;
          }
          screenStream.getVideoTracks()[0].onended = () => {
            setActiveCall((prev) => (prev ? { ...prev, isScreenSharing: false } : null));
            if (localVideoRef.current && localStreamRef.current) {
              localVideoRef.current.srcObject = localStreamRef.current;
            }
          };
          setActiveCall((prev) => ({ ...prev, isScreenSharing: true }));
        }
      } catch (err) {
        console.warn('Screen share canceled or denied:', err);
      }
    }
  };

  const answerIncomingCall = () => {
    if (!incomingCall) return;
    const type = incomingCall.callType || 'voice';
    if (socket && incomingCall.roomId) {
      socket.emit('accept-call', {
        roomId: incomingCall.roomId,
        accepter: currentUser?._id || currentUser?.id
      });
    }
    setIncomingCall(null);
    startCall(type);
  };

  const declineIncomingCall = () => {
    if (!incomingCall) return;
    if (socket && incomingCall.roomId) {
      socket.emit('decline-call', {
        roomId: incomingCall.roomId,
        decliner: currentUser?._id || currentUser?.id
      });
    }
    setIncomingCall(null);
  };

  // Timer effect when connected
  useEffect(() => {
    if (activeCall && activeCall.status === 'connected') {
      callTimerRef.current = setInterval(() => {
        setCallDuration((prev) => prev + 1);
      }, 1000);
    } else {
      if (callTimerRef.current) {
        clearInterval(callTimerRef.current);
        callTimerRef.current = null;
      }
    }
    return () => {
      if (callTimerRef.current) {
        clearInterval(callTimerRef.current);
        callTimerRef.current = null;
      }
    };
  }, [activeCall?.status]);

  // Attach video stream whenever localVideoRef or activeCall changes
  useEffect(() => {
    if (activeCall && (activeCall.type === 'video' || activeCall.isScreenSharing)) {
      if (localVideoRef.current) {
        const target = screenStreamRef.current || localStreamRef.current;
        if (target && localVideoRef.current.srcObject !== target) {
          localVideoRef.current.srcObject = target;
        }
      }
    }
  }, [activeCall?.type, activeCall?.isVideoOff, activeCall?.isScreenSharing]);

  const handleOpenTaskModalFromChat = () => {
    const today = new Date();
    today.setDate(today.getDate() + 1);
    const tomorrowStr = today.toISOString().split('T')[0];

    let defaultAssignees = [];
    if (activeGroup?.type === 'direct' && Array.isArray(activeGroup.members)) {
      const myId = currentUser?._id || currentUser?.id;
      const otherMember = activeGroup.members.find(m => {
        const mId = typeof m === 'object' ? (m._id || m.id) : m;
        return String(mId) !== String(myId);
      });
      if (otherMember) {
        defaultAssignees = [typeof otherMember === 'object' ? (otherMember._id || otherMember.id) : otherMember];
      }
    }

    setChatTaskForm({
      title: '',
      description: '',
      priority: 'medium',
      dueDate: tomorrowStr,
      assignees: defaultAssignees,
      projectRef: activeGroup?.name || '',
      clientName: ''
    });
    setShowChatTaskModal(true);
  };

  const handleOpenTaskModalFromMsg = (msg) => {
    const today = new Date();
    today.setDate(today.getDate() + 1);
    const tomorrowStr = today.toISOString().split('T')[0];

    const senderName = typeof msg.senderId === 'object' ? (msg.senderId?.name || msg.senderId?.username) : (msg.senderName || 'Staff Member');
    const text = msg.content || msg.text || '';
    const firstLine = text.split('\n')[0].trim();
    const suggestedTitle = firstLine ? (firstLine.length > 70 ? firstLine.slice(0, 67) + '...' : firstLine) : 'Task from Chat';

    let defaultAssignees = [];
    if (activeGroup?.type === 'direct' && Array.isArray(activeGroup.members)) {
      const myId = currentUser?._id || currentUser?.id;
      const otherMember = activeGroup.members.find(m => {
        const mId = typeof m === 'object' ? (m._id || m.id) : m;
        return String(mId) !== String(myId);
      });
      if (otherMember) {
        defaultAssignees = [typeof otherMember === 'object' ? (otherMember._id || otherMember.id) : otherMember];
      }
    } else if (msg.senderId) {
      const sId = typeof msg.senderId === 'object' ? (msg.senderId._id || msg.senderId.id) : msg.senderId;
      if (sId) defaultAssignees = [sId];
    }

    const jobMatch = text.match(/#?(\d{3,6})/);
    const projectRef = jobMatch ? `Job #${jobMatch[1]}` : (activeGroup?.name || '');

    setChatTaskForm({
      title: suggestedTitle,
      description: `Reference: Message by ${senderName} in ${activeGroup?.name || 'Chat'}:\n"${text}"`,
      priority: msg.priority === 'urgent' ? 'urgent' : 'medium',
      dueDate: tomorrowStr,
      assignees: defaultAssignees,
      projectRef: projectRef,
      clientName: ''
    });
    setShowChatTaskModal(true);
  };

  const handleSubmitChatTask = async (e) => {
    e.preventDefault();
    if (!chatTaskForm.title.trim()) {
      alert('Please enter a task title.');
      return;
    }
    setIsCreatingChatTask(true);
    try {
      const myId = currentUser?._id || currentUser?.id;
      const myName = currentUser?.name || currentUser?.username || 'Staff User';

      const res = await api.createTask({
        title: chatTaskForm.title.trim(),
        description: chatTaskForm.description.trim(),
        priority: chatTaskForm.priority,
        status: 'todo',
        projectRef: chatTaskForm.projectRef.trim(),
        clientName: chatTaskForm.clientName.trim(),
        dueDate: chatTaskForm.dueDate || undefined,
        assignees: chatTaskForm.assignees && chatTaskForm.assignees.length > 0 ? chatTaskForm.assignees : (myId ? [myId] : []),
        createdBy: myId,
        createdByName: myName
      });

      if (res.success && res.data) {
        const task = res.data;
        const assigneeNames = Array.isArray(chatTaskForm.assignees) && chatTaskForm.assignees.length > 0
          ? chatTaskForm.assignees.map(aId => {
              const matched = staffUsers.find(u => String(u._id || u.id) === String(aId));
              return matched?.name || matched?.username || 'Staff';
            }).join(', ')
          : myName;

        // Post chat confirmation
        if (activeGroup?._id) {
          const chatNotice = `📋 *Task Created:* "${task.title}"\n🎯 Assigned to: ${assigneeNames}\n⚡ Priority: ${task.priority.toUpperCase()} | Due: ${task.dueDate ? task.dueDate.split('T')[0] : 'N/A'}`;
          try {
            await api.sendCommunicationMessage(activeGroup._id, {
              roomId: activeGroup._id,
              senderId: myId,
              content: chatNotice,
              priority: task.priority === 'urgent' ? 'urgent' : 'normal'
            });
          } catch (mErr) {
            console.warn('Could not post chat notice for task creation:', mErr);
          }
        }

        window.dispatchEvent(new CustomEvent('elite-data-refresh', { detail: 'task' }));
        setShowChatTaskModal(false);
      }
    } catch (err) {
      alert('Failed to create task: ' + err.message);
    } finally {
      setIsCreatingChatTask(false);
    }
  };

  const socket = useSocket();
  const chatBottomRef = useRef(null);
  const fileInputRef = useRef(null);

  // Ref to track activeGroup._id without triggering re-render loops / closure bugs
  const activeGroupIdRef = useRef(null);
  const messagesCacheRef = useRef({});

  useEffect(() => {
    activeGroupIdRef.current = activeGroup?._id;
  }, [activeGroup?._id]);

  // Keep in-memory cache synchronized with current messages
  useEffect(() => {
    if (activeGroup?._id && messages && messages.length > 0) {
      messagesCacheRef.current[activeGroup._id] = messages;
    }
  }, [activeGroup?._id, messages]);

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

      // Emergency SOS chime & vibration if message is urgent
      if (msg.priority === 'urgent') {
        const senderId = typeof msg.senderId === 'object' ? (msg.senderId._id || msg.senderId.id) : msg.senderId;
        if (String(senderId) !== String(uId)) {
          try {
            if (!chatSoundMuted) {
              const AudioCtx = window.AudioContext || window.webkitAudioContext;
              if (AudioCtx) {
                const ctx = new AudioCtx();
                const osc = ctx.createOscillator();
                const gain = ctx.createGain();
                osc.type = 'sawtooth';
                osc.frequency.setValueAtTime(880, ctx.currentTime);
                osc.frequency.setValueAtTime(440, ctx.currentTime + 0.12);
                osc.frequency.setValueAtTime(880, ctx.currentTime + 0.24);
                gain.gain.setValueAtTime(0.3, ctx.currentTime);
                gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.38);
                osc.connect(gain);
                gain.connect(ctx.destination);
                osc.start();
                osc.stop(ctx.currentTime + 0.38);
              }
            }
            if (typeof navigator !== 'undefined' && navigator.vibrate) {
              navigator.vibrate([300, 100, 300]);
            }
          } catch (e) {}
        }
      }

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

    const handleIncomingCall = (data) => {
      if (data && data.roomId) {
        setIncomingCall(data);
      }
    };

    const handleCallAccepted = () => {
      setActiveCall((prev) => (prev ? { ...prev, status: 'connected' } : null));
    };

    const handleCallDeclined = () => {
      setActiveCall((prev) => (prev ? { ...prev, status: 'ended', error: 'Call declined by user' } : null));
      setTimeout(() => setActiveCall(null), 1800);
    };

    const handleCallEnded = () => {
      endCall(false);
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
    socket.on('incoming-call', handleIncomingCall);
    socket.on('call-accepted', handleCallAccepted);
    socket.on('call-declined', handleCallDeclined);
    socket.on('call-ended', handleCallEnded);

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
      socket.off('incoming-call', handleIncomingCall);
      socket.off('call-accepted', handleCallAccepted);
      socket.off('call-declined', handleCallDeclined);
      socket.off('call-ended', handleCallEnded);
    };
  }, [socket, currentUser]);

  // Join socket room when active group changes & fetch messages with in-memory caching
  useEffect(() => {
    if (!activeGroup?._id) return;

    if (socket) {
      socket.emit('join-room', activeGroup._id);
    }

    const cached = messagesCacheRef.current[activeGroup._id];
    if (cached && cached.length > 0) {
      setMessages(cached);
      setLoadingMessages(false);
      // Background sync without blocking user interaction
      fetchGroupMessages(activeGroup._id, msgFilter, false);
    } else {
      // First time loading this conversation
      fetchGroupMessages(activeGroup._id, msgFilter, true);
    }
  }, [socket, activeGroup?._id, msgFilter]);

  const handleSelectGroup = (targetGroup) => {
    if (!targetGroup) return;
    if (activeGroup?._id && inputMessage) {
      setRoomDrafts((prev) => ({
        ...prev,
        [activeGroup._id]: inputMessage
      }));
    }

    // Instantly show cached messages if available
    const cached = messagesCacheRef.current[targetGroup._id];
    if (cached && cached.length > 0) {
      setMessages(cached);
      setLoadingMessages(false);
    } else {
      setMessages([]);
      setLoadingMessages(true);
    }

    setActiveGroup(targetGroup);
    if (typeof localStorage !== 'undefined' && targetGroup._id) {
      localStorage.setItem('elite_active_chat_room_id', targetGroup._id);
    }
    setInputMessage(roomDrafts[targetGroup._id] || '');
    if (socket && targetGroup._id) {
      socket.emit('join-room', targetGroup._id);
    }
    // Note: The useEffect on activeGroup?._id handles background/initial fetch automatically
  };

  // Auto-scroll to chat bottom
  useEffect(() => {
    if (chatBottomRef.current) {
      chatBottomRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, viewportHeight]);

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
        if (!filter || filter === 'all') {
          messagesCacheRef.current[groupId] = list;
        }

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
      setLoadingMessages(false);
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

  // ── AUDIO VOICE NOTE RECORDING & PUSH-TO-TALK HANDLERS ──
  const sendVoiceNoteMessage = async (audioAttachment) => {
    const currentGroup = activeGroupRef.current;
    if (!audioAttachment || !currentGroup) return;
    const sender = currentUserRef.current;
    const senderId = sender?.id || sender?._id;
    if (!senderId) return;

    const messageText = `Attached ${audioAttachment.fileName}`;
    const messagePayload = {
      roomId: currentGroup._id,
      senderId,
      content: messageText,
      priority: isUrgent ? 'urgent' : 'normal',
      attachment: audioAttachment,
    };

    const tempId = 'temp_' + Date.now();
    const tempMsg = {
      _id: tempId,
      roomId: currentGroup._id,
      senderId: typeof sender === 'object' ? sender : { _id: senderId, name: 'You' },
      content: messageText,
      createdAt: new Date().toISOString(),
      type: 'text',
      msgType: 'human',
      priority: isUrgent ? 'urgent' : 'normal',
      attachment: audioAttachment,
      readBy: [senderId],
      isOptimistic: true
    };

    setMessages((prev) => [...prev, tempMsg]);
    setIsUrgent(false);

    try {
      const res = await api.sendCommunicationMessage(currentGroup._id, messagePayload);
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

        const duration = recordingSecondsRef.current || 1;
        const audioFile = new File([audioBlob], `voice_note_${Date.now()}.webm`, { type: 'audio/webm' });
        setUploadingFile(true);
        try {
          const currentGroup = activeGroupRef.current;
          const roomName = currentGroup?.name || 'General';
          const res = await api.uploadChatAttachment(audioFile, roomName);
          if (res && res.fileUrl) {
            const attachmentData = {
              fileName: `Voice Note (${duration}s)`,
              fileType: 'audio',
              fileUrl: res.fileUrl,
              fileSize: res.fileSize || audioBlob.size,
              durationSec: duration
            };
            if (autoSendRef.current) {
              await sendVoiceNoteMessage(attachmentData);
            } else {
              setAttachedFile(attachmentData);
            }
          }
        } catch (err) {
          alert('Failed to upload voice note: ' + err.message);
        } finally {
          setUploadingFile(false);
          autoSendRef.current = false;
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
      setIsRecordingAudio(false);
    }
  };

  const stopAudioRecording = (autoSend = false) => {
    autoSendRef.current = autoSend;
    if (recordingTimerRef.current) clearInterval(recordingTimerRef.current);
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop();
    }
    setIsRecordingAudio(false);
    setSlideCancelActive(false);
  };

  const cancelAudioRecording = () => {
    autoSendRef.current = false;
    isCancelGestureRef.current = false;
    setSlideCancelActive(false);
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

  // Push-to-Talk touch & mouse listeners
  const handlePushToTalkStart = (e) => {
    isCancelGestureRef.current = false;
    setSlideCancelActive(false);
    isPushToTalkRef.current = true;
    recordingStartTimeRef.current = Date.now();
    if (e.touches && e.touches[0]) {
      touchStartYRef.current = e.touches[0].clientY;
    } else {
      touchStartYRef.current = null;
    }
    startAudioRecording();
  };

  const handlePushToTalkMove = (e) => {
    if (!isRecordingAudio) return;
    if (e.touches && e.touches[0] && touchStartYRef.current !== null) {
      const currentY = e.touches[0].clientY;
      if (touchStartYRef.current - currentY > 40) {
        if (!isCancelGestureRef.current) {
          isCancelGestureRef.current = true;
          setSlideCancelActive(true);
        }
      } else {
        if (isCancelGestureRef.current) {
          isCancelGestureRef.current = false;
          setSlideCancelActive(false);
        }
      }
    }
  };

  const handlePushToTalkEnd = () => {
    if (!isRecordingAudio) return;
    const elapsed = Date.now() - recordingStartTimeRef.current;

    if (isCancelGestureRef.current) {
      cancelAudioRecording();
      isCancelGestureRef.current = false;
      setSlideCancelActive(false);
      isPushToTalkRef.current = false;
      return;
    }

    if (elapsed >= 650) {
      // Held and released -> auto-send voice note!
      stopAudioRecording(true);
    } else {
      // Short tap (< 650ms) -> keep recording open for hands-free mode
      isPushToTalkRef.current = false;
    }
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
      permissionScope: scopeVal,
      recordData: item
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
      department: u.department || 'General',
      unreadCount: 0
    }));

    let baseItems = [];
    if (rosterTab === 'groups') {
      baseItems = groups.filter((g) => g.type !== 'direct');
    } else if (rosterTab === 'direct') {
      baseItems = [...activeDmRooms, ...contactUsers];
    } else {
      // 'all': combined groups, active DMs, and colleagues
      baseItems = [...groups.filter((g) => g.type !== 'direct'), ...activeDmRooms, ...contactUsers];
    }

    // Filter by Phoenix Segmented Tabs: All | Read | Unread
    if (phoenixFilter === 'read') {
      baseItems = baseItems.filter((g) => (Number(g.unreadCount) || 0) === 0);
    } else if (phoenixFilter === 'unread') {
      baseItems = baseItems.filter((g) => (Number(g.unreadCount) || 0) > 0);
    }

    if (!term) return baseItems;

    return baseItems.filter((item) => {
      if (item.isVirtualContact) {
        return (item.name || '').toLowerCase().includes(term) ||
               (item.user?.department || '').toLowerCase().includes(term) ||
               (item.user?.role || '').toLowerCase().includes(term);
      }
      if (item.type === 'direct') {
        const colleague = getDMColleague(item);
        const cName = colleague ? (colleague.name || colleague.username || '').toLowerCase() : (item.name || '').toLowerCase();
        return cName.includes(term);
      }
      return (
        (item.name || '').toLowerCase().includes(term) ||
        (item.department || '').toLowerCase().includes(term) ||
        (item.permissionScope || '').toLowerCase().includes(term)
      );
    });
  }, [groups, allUsers, rosterTab, phoenixFilter, searchQuery, currentUser]);

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

  const handleOpenJobCardPdf = async (meta, rawData = null) => {
    const initialCard = rawData || meta?.recordData;
    if (initialCard && (initialCard.jobNo || initialCard._id)) {
      setPdfPreviewCard(initialCard);
      setPdfPreviewLoading(false);
      setPdfPreviewError('');
      return;
    }

    const cleanJobNo = String(meta?.recordRef || meta?.content || '')
      .replace(/^(JC|Job\s*Card)[\s#-:]*/i, '')
      .replace(/[—–-].*$/, '')
      .trim();

    setPdfPreviewCard({ jobNo: cleanJobNo || '...' });
    setPdfPreviewLoading(true);
    setPdfPreviewError('');

    try {
      let card = null;
      const refOrId = meta?.recordId || cleanJobNo || meta?.recordRef;
      if (refOrId) {
        try {
          const res = await api.getJobCard(refOrId);
          if (res && (res._id || res.jobNo)) card = res;
        } catch (e) {}
      }

      if (!card && cleanJobNo) {
        const searchRes = await api.getJobCards({ search: cleanJobNo, limit: 1 });
        const list = Array.isArray(searchRes) ? searchRes : (searchRes?.data || []);
        if (list.length > 0) card = list[0];
      }

      if (card) {
        setPdfPreviewCard(card);
      } else {
        setPdfPreviewError(`Could not load details for Job Card ${cleanJobNo || ''}`);
      }
    } catch (err) {
      console.error('Failed to load job card for PDF view:', err);
      setPdfPreviewError('Failed to load Job Card');
    } finally {
      setPdfPreviewLoading(false);
    }
  };

  const handleRecordClick = (meta, rawData = null) => {
    if (!meta) return;
    const scope = (meta.permissionScope || meta.module || '').toLowerCase();
    if (scope.includes('jobcard') || scope.includes('job card') || (meta.recordRef && String(meta.recordRef).toUpperCase().startsWith('JC-'))) {
      handleOpenJobCardPdf(meta, rawData);
      return;
    }
    if (!onNavigateTab) return;
    if (scope.includes('catalogue') || scope.includes('design')) onNavigateTab('catalog');
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
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        width: '100%',
        height: isMobileScreen && activeGroup
          ? (viewportHeight ? `${viewportHeight}px` : '100dvh')
          : '100%',
        padding: isMobileScreen ? 0 : '0.85rem',
        boxSizing: 'border-box',
        overflow: 'hidden',
        background: isMobileScreen ? 'var(--bg-card, #ffffff)' : 'var(--bg-main, #f5f7fa)'
      }}
    >
      {/* ── MAIN CONTENT VIEW (IF TASK MODE: FULL TASK PANEL | IF CHAT MODE: PHOENIX CHAT LAYOUT) ── */}
      {mainTab === 'task' ? (
        <div style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0.6rem 1rem', background: 'var(--bg-card)', borderBottom: '1px solid var(--border-light)', flexShrink: 0 }}>
            <button
              type="button"
              onClick={() => setMainTab('chat')}
              className="phoenix-action-btn-neutral"
              style={{ gap: '6px', width: 'auto', padding: '0 12px', fontSize: '0.82rem', fontWeight: 700 }}
            >
              <ChevronLeft size={16} />
              <span>Back to Chats</span>
            </button>
            <h3 style={{ margin: 0, fontSize: '0.95rem', fontWeight: 800, color: 'var(--text-primary)' }}>Task Management Board</h3>
            <div />
          </div>
          <div style={{ flex: 1, minHeight: 0, overflow: 'hidden' }}>
            <TaskManagerPanel currentUser={currentUser} onNavigateTab={onNavigateTab} />
          </div>
        </div>
      ) : (
      <div className="phoenix-chat-layout" style={{ flex: 1, minHeight: 0, overflow: 'hidden' }}>
        
        {/* ════ LEFT COLUMN: PHOENIX CONVERSATIONS SIDEBAR ════ */}
        <div className="phoenix-chat-sidebar" style={{ display: (isMobileScreen && activeGroup) ? 'none' : 'flex' }}>
          
          {/* Phoenix Sidebar Top Bar: Chats title + Presence + Task toggle + Add Chat button */}
          <div style={{ padding: '0.85rem 1rem 0.65rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0, borderBottom: '1px solid var(--border-light, #e3e6ed)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <h2 style={{ margin: 0, fontSize: '1.18rem', fontWeight: 800, color: 'var(--text-primary, #141824)', letterSpacing: '-0.02em' }}>
                Chats
              </h2>
              <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#25b865', display: 'inline-block' }} title="Live Presence Active" />
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              {/* Task Toggle Pill */}
              <button
                type="button"
                onClick={() => setMainTab('task')}
                className="phoenix-action-btn-neutral"
                style={{ width: 'auto', padding: '0 10px', height: '32px', fontSize: '0.76rem', fontWeight: 700, gap: '4px' }}
                title="Switch to Kanban Tasks"
              >
                <CheckSquare size={13} color="#3874ff" />
                <span>Tasks</span>
              </button>

              {/* + Button for New Chat / Group */}
              <button
                type="button"
                onClick={currentUser?.role === 'admin' ? handleOpenCreateGroupModal : handleOpenNewDmModal}
                className="phoenix-action-btn-blue"
                style={{ width: '32px', height: '32px', borderRadius: '8px' }}
                title={currentUser?.role === 'admin' ? "Create Group Channel" : "New Direct Message"}
              >
                <Plus size={16} />
              </button>
            </div>
          </div>

          {/* Phoenix Search Box */}
          <div style={{ padding: '0.75rem 0.85rem 0.45rem', flexShrink: 0 }}>
            <div className="phoenix-search-box">
              <User size={15} color="var(--text-muted, #9aa5b8)" style={{ flexShrink: 0 }} />
              <input
                type="text"
                className="phoenix-search-input"
                placeholder="People, Groups and Messages"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery('')}
                  style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', padding: '2px', display: 'flex', alignItems: 'center' }}
                >
                  <X size={13} />
                </button>
              )}
            </div>
          </div>

          {/* Phoenix Filter Segmented Tabs (All | Read | Unread) */}
          <div style={{ padding: '0 0.85rem 0.65rem', flexShrink: 0 }}>
            <div className="phoenix-tab-segmented">
              <button
                type="button"
                className={`phoenix-tab-pill ${phoenixFilter === 'all' ? 'active' : ''}`}
                onClick={() => setPhoenixFilter('all')}
              >
                <span>All</span>
              </button>
              <button
                type="button"
                className={`phoenix-tab-pill ${phoenixFilter === 'read' ? 'active' : ''}`}
                onClick={() => setPhoenixFilter('read')}
              >
                <span>Read</span>
              </button>
              <button
                type="button"
                className={`phoenix-tab-pill ${phoenixFilter === 'unread' ? 'active' : ''}`}
                onClick={() => setPhoenixFilter('unread')}
              >
                <span>Unread</span>
                {totalChatUnreadCount > 0 && (
                  <span style={{
                    background: phoenixFilter === 'unread' ? '#3874ff' : '#ef4444',
                    color: '#ffffff',
                    fontSize: '0.62rem',
                    fontWeight: 800,
                    padding: '1px 5px',
                    borderRadius: '10px',
                    marginLeft: '2px'
                  }}>
                    {totalChatUnreadCount > 99 ? '99+' : totalChatUnreadCount}
                  </span>
                )}
              </button>
            </div>
          </div>

          {/* Phoenix Conversation Items List */}
          <div style={{ flex: 1, overflowY: 'auto', padding: '0.2rem 0.75rem 0.75rem' }}>
            {loadingGroups ? (
              <div style={{ padding: '2.5rem 1rem', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.85rem' }}>
                <RefreshCw size={20} className="spin-loader" style={{ marginBottom: '0.5rem' }} />
                <div>Loading conversations...</div>
              </div>
            ) : filteredGroups.length === 0 ? (
              <div style={{ padding: '2.5rem 1rem', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.82rem' }}>
                <div>No conversations found in {phoenixFilter}.</div>
                <button
                  type="button"
                  onClick={handleOpenNewDmModal}
                  style={{ marginTop: '0.75rem', background: 'none', border: 'none', color: '#3874ff', fontSize: '0.8rem', fontWeight: 700, cursor: 'pointer' }}
                >
                  + Start a new direct conversation
                </button>
              </div>
            ) : (
              filteredGroups.map((group) => {
                const isVirtual = group.isVirtualContact;
                const isActive = !isVirtual && activeGroup && String(activeGroup._id) === String(group._id);
                const isDirect = group.type === 'direct';
                const colleague = isDirect ? (isVirtual ? group.user : getDMColleague(group)) : null;
                const colleagueName = colleague ? (typeof colleague === 'object' ? (colleague.name || colleague.username || colleague.email) : group.name) : group.name;
                const displayName = isDirect ? (colleagueName || group.name || 'Private DM') : group.name;
                const deptCol = isDirect ? '#3874ff' : getDeptColor(group.department);

                return (
                  <div
                    key={group._id}
                    className={`phoenix-chat-item ${isActive ? 'active' : ''}`}
                    onClick={() => {
                      if (isVirtual && group.user) {
                        handleStartDirectChat(group.user);
                      } else {
                        handleSelectGroup(group);
                      }
                    }}
                  >
                    {/* Left: Avatar with green active presence dot */}
                    <div
                      className="phoenix-avatar-wrap"
                      style={{
                        background: isDirect
                          ? 'linear-gradient(135deg, #38bdf8 0%, #2563eb 100%)'
                          : `${deptCol}18`,
                        color: isDirect ? '#ffffff' : deptCol,
                        border: isDirect ? 'none' : `1.5px solid ${deptCol}35`
                      }}
                    >
                      {isDirect ? (
                        (displayName || 'D').charAt(0).toUpperCase()
                      ) : (
                        <Building2 size={18} color={deptCol} />
                      )}
                      <span className="phoenix-online-dot" title="Active now" />
                    </div>

                    {/* Center & Right: Name, preview snippet, time, unread badge */}
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '6px' }}>
                        <span style={{
                          fontSize: '0.86rem',
                          fontWeight: isActive ? 800 : 700,
                          color: 'var(--text-primary)',
                          whiteSpace: 'nowrap',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis'
                        }}>
                          {displayName}
                        </span>
                        <span style={{ fontSize: '0.68rem', color: 'var(--text-muted)', whiteSpace: 'nowrap', flexShrink: 0 }}>
                          {group.lastMessage ? formatTime(group.lastMessage.createdAt) : ''}
                        </span>
                      </div>

                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '6px', marginTop: '3px' }}>
                        <p style={{
                          margin: 0,
                          fontSize: '0.74rem',
                          color: 'var(--text-muted)',
                          whiteSpace: 'nowrap',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          fontWeight: group.unreadCount > 0 ? 600 : 400
                        }}>
                          {group.lastMessage
                            ? (group.lastMessage.msgType === 'system_activity' ? '🤖 Activity Logged' : group.lastMessage.content)
                            : (isDirect ? 'Say Hi to your new friend now' : (group.description || 'Channel conversation'))}
                        </p>

                        <div style={{ display: 'flex', alignItems: 'center', gap: '4px', flexShrink: 0 }}>
                          {group.unreadCount > 0 && (
                            <span className="phoenix-unread-pill">
                              {group.unreadCount > 99 ? '99+' : `${group.unreadCount}+`}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* ════ RIGHT COLUMN: PHOENIX ACTIVE CHAT STREAM ════ */}
        <div className="phoenix-chat-main" style={{ display: (isMobileScreen && !activeGroup) ? 'none' : 'flex' }}>
          
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
                const deptCol = isDirect ? '#3874ff' : getDeptColor(activeGroup.department);

                return (
                  <>
                    <div style={{
                      padding: isMobileScreen ? '0.65rem 0.85rem' : '0.85rem 1.25rem',
                      borderBottom: '1px solid var(--border-light, #e2e8f0)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      background: 'var(--bg-card)',
                      flexShrink: 0,
                      position: 'relative',
                      gap: '0.75rem'
                    }}>
                      {/* Left: Back Button (Mobile) + Avatar + Display Name with Chevron Dropdown + Active now indicator */}
                      <div style={{ display: 'flex', alignItems: 'center', gap: isMobileScreen ? '0.5rem' : '0.75rem', minWidth: 0 }}>
                        {isMobileScreen && activeGroup && (
                          <button
                            type="button"
                            onClick={() => { setActiveGroup(null); setShowMobileActionMenu(false); setShowMobileHeaderMenu(false); }}
                            className="phoenix-action-btn-neutral"
                            style={{
                              width: '32px',
                              height: '32px',
                              padding: 0,
                              marginRight: '2px',
                              flexShrink: 0
                            }}
                            title="Back to conversation list"
                          >
                            <ChevronLeft size={18} color="var(--text-primary)" />
                          </button>
                        )}

                        {/* Avatar with Online Dot */}
                        <div
                          className="phoenix-avatar-wrap"
                          style={{
                            width: isMobileScreen ? 36 : 40,
                            height: isMobileScreen ? 36 : 40,
                            background: isDirect
                              ? 'linear-gradient(135deg, #38bdf8 0%, #2563eb 100%)'
                              : `${deptCol}18`,
                            color: isDirect ? '#ffffff' : deptCol,
                            border: isDirect ? 'none' : `1.5px solid ${deptCol}35`
                          }}
                        >
                          {isDirect ? (
                            (displayName || 'D').charAt(0).toUpperCase()
                          ) : (
                            <Building2 size={18} color={deptCol} />
                          )}
                          <span className="phoenix-online-dot" title="Active now" />
                        </div>

                        {/* Name + Dropdown Chevron + Active Now Status */}
                        <div style={{ minWidth: 0 }}>
                          <button
                            type="button"
                            onClick={() => setShowDesktopHeaderMenu(!showDesktopHeaderMenu)}
                            style={{
                              background: 'none',
                              border: 'none',
                              padding: 0,
                              cursor: 'pointer',
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '5px',
                              textAlign: 'left'
                            }}
                            title="Click for conversation options"
                          >
                            <h3 style={{
                              margin: 0,
                              fontSize: isMobileScreen ? '0.92rem' : '1.05rem',
                              fontWeight: 800,
                              color: 'var(--text-primary)',
                              whiteSpace: 'nowrap',
                              overflow: 'hidden',
                              textOverflow: 'ellipsis'
                            }}>
                              {displayName}
                            </h3>
                            <ChevronDown size={15} color="var(--text-muted)" style={{ flexShrink: 0 }} />
                          </button>

                          <div style={{ display: 'flex', alignItems: 'center', gap: '5px', marginTop: '2px' }}>
                            <span style={{ width: 7, height: 7, borderRadius: '50%', background: '#22c55e', display: 'inline-block' }} />
                            <span style={{ fontSize: '0.72rem', color: '#10b981', fontWeight: 600 }}>
                              Active now
                            </span>
                          </div>
                        </div>
                      </div>

                      {/* Right: Phone, Video, and More Options Buttons (Phoenix 1:1) */}
                      <div style={{ display: 'flex', alignItems: 'center', gap: isMobileScreen ? '4px' : '8px', flexShrink: 0 }}>
                        {/* Phone Call Button */}
                        <button
                          type="button"
                          className="phoenix-action-btn-blue"
                          style={{ width: isMobileScreen ? 32 : 36, height: isMobileScreen ? 32 : 36 }}
                          onClick={() => startCall('voice')}
                          title="Start HD Voice Call"
                        >
                          <Phone size={isMobileScreen ? 14 : 16} />
                        </button>

                        {/* Video Call Button */}
                        <button
                          type="button"
                          className="phoenix-action-btn-blue"
                          style={{ width: isMobileScreen ? 32 : 36, height: isMobileScreen ? 32 : 36 }}
                          onClick={() => startCall('video')}
                          title="Start HD Video Call"
                        >
                          <Video size={isMobileScreen ? 14 : 16} />
                        </button>

                        {/* Three Dots More Options Menu */}
                        <div style={{ position: 'relative' }}>
                          <button
                            type="button"
                            className="phoenix-action-btn-neutral"
                            style={{ width: isMobileScreen ? 32 : 36, height: isMobileScreen ? 32 : 36 }}
                            onClick={(e) => {
                              e.stopPropagation();
                              setShowDesktopHeaderMenu(!showDesktopHeaderMenu);
                            }}
                            title="More Conversation Options"
                          >
                            <MoreVertical size={isMobileScreen ? 14 : 16} />
                          </button>

                          {/* Dropdown Menu */}
                          {showDesktopHeaderMenu && (
                            <>
                              <div
                                onClick={() => setShowDesktopHeaderMenu(false)}
                                style={{ position: 'fixed', inset: 0, zIndex: 9998, background: 'transparent' }}
                              />
                              <div style={{
                                position: 'absolute',
                                top: 'calc(100% + 6px)',
                                right: 0,
                                background: 'var(--bg-card, #ffffff)',
                                border: '1px solid var(--border-light, #e2e8f0)',
                                borderRadius: '12px',
                                boxShadow: '0 12px 30px rgba(0,0,0,0.18)',
                                zIndex: 9999,
                                padding: '6px',
                                minWidth: '210px',
                                display: 'flex',
                                flexDirection: 'column',
                                gap: '2px'
                              }}>
                                {/* Start Voice Call */}
                                <button
                                  type="button"
                                  onClick={() => { setShowDesktopHeaderMenu(false); startCall('voice'); }}
                                  style={{
                                    display: 'flex', alignItems: 'center', gap: '8px', padding: '8px 12px',
                                    background: 'transparent', border: 'none', borderRadius: '6px', textAlign: 'left',
                                    fontSize: '0.8rem', color: 'var(--text-primary)', cursor: 'pointer', fontWeight: 600
                                  }}
                                >
                                  <Phone size={14} color="#2563eb" />
                                  <span>Start Voice Call</span>
                                </button>

                                {/* Start Video Call */}
                                <button
                                  type="button"
                                  onClick={() => { setShowDesktopHeaderMenu(false); startCall('video'); }}
                                  style={{
                                    display: 'flex', alignItems: 'center', gap: '8px', padding: '8px 12px',
                                    background: 'transparent', border: 'none', borderRadius: '6px', textAlign: 'left',
                                    fontSize: '0.8rem', color: 'var(--text-primary)', cursor: 'pointer', fontWeight: 600
                                  }}
                                >
                                  <Video size={14} color="#3b82f6" />
                                  <span>Start Video Call</span>
                                </button>

                                <div style={{ height: '1px', background: 'var(--border-light, #e2e8f0)', margin: '4px 0' }} />

                                {/* In-room Search */}
                                <button
                                  type="button"
                                  onClick={() => { setShowDesktopHeaderMenu(false); setShowInRoomSearch(!showInRoomSearch); }}
                                  style={{
                                    display: 'flex', alignItems: 'center', gap: '8px', padding: '8px 12px',
                                    background: 'transparent', border: 'none', borderRadius: '6px', textAlign: 'left',
                                    fontSize: '0.8rem', color: 'var(--text-primary)', cursor: 'pointer', fontWeight: 600
                                  }}
                                >
                                  <Search size={14} color="#3874ff" />
                                  <span>Search in Chat</span>
                                </button>

                                {/* Gallery */}
                                <button
                                  type="button"
                                  onClick={() => { setShowDesktopHeaderMenu(false); setShowGalleryModal(true); }}
                                  style={{
                                    display: 'flex', alignItems: 'center', gap: '8px', padding: '8px 12px',
                                    background: 'transparent', border: 'none', borderRadius: '6px', textAlign: 'left',
                                    fontSize: '0.8rem', color: 'var(--text-primary)', cursor: 'pointer', fontWeight: 600
                                  }}
                                >
                                  <Folder size={14} color="#2563eb" />
                                  <span>Shared Gallery</span>
                                </button>

                                {/* Create Task from chat */}
                                <button
                                  type="button"
                                  onClick={() => { setShowDesktopHeaderMenu(false); handleOpenTaskModalFromChat(); }}
                                  style={{
                                    display: 'flex', alignItems: 'center', gap: '8px', padding: '8px 12px',
                                    background: 'transparent', border: 'none', borderRadius: '6px', textAlign: 'left',
                                    fontSize: '0.8rem', color: 'var(--text-primary)', cursor: 'pointer', fontWeight: 600
                                  }}
                                >
                                  <CheckSquare size={14} color="#10b981" />
                                  <span>Create Task</span>
                                </button>

                                {/* Create Poll */}
                                <button
                                  type="button"
                                  onClick={() => { setShowDesktopHeaderMenu(false); setShowPollModal(true); }}
                                  style={{
                                    display: 'flex', alignItems: 'center', gap: '8px', padding: '8px 12px',
                                    background: 'transparent', border: 'none', borderRadius: '6px', textAlign: 'left',
                                    fontSize: '0.8rem', color: 'var(--text-primary)', cursor: 'pointer', fontWeight: 600
                                  }}
                                >
                                  <BarChart2 size={14} color="#059669" />
                                  <span>Create Poll</span>
                                </button>

                                {/* Share Record */}
                                <button
                                  type="button"
                                  onClick={() => { setShowDesktopHeaderMenu(false); handleOpenShareModal('jobcard'); }}
                                  style={{
                                    display: 'flex', alignItems: 'center', gap: '8px', padding: '8px 12px',
                                    background: 'transparent', border: 'none', borderRadius: '6px', textAlign: 'left',
                                    fontSize: '0.8rem', color: 'var(--text-primary)', cursor: 'pointer', fontWeight: 600
                                  }}
                                >
                                  <Share2 size={14} color="#9333ea" />
                                  <span>Share Record Card</span>
                                </button>

                                {/* Members (if group) */}
                                {!isDirect && (
                                  <button
                                    type="button"
                                    onClick={() => { setShowDesktopHeaderMenu(false); handleOpenMembers(); }}
                                    style={{
                                      display: 'flex', alignItems: 'center', gap: '8px', padding: '8px 12px',
                                      background: 'transparent', border: 'none', borderRadius: '6px', textAlign: 'left',
                                      fontSize: '0.8rem', color: 'var(--text-primary)', cursor: 'pointer', fontWeight: 600
                                    }}
                                  >
                                    <Users size={14} color="#0ea5e9" />
                                    <span>Members ({activeGroup.members?.length || 0})</span>
                                  </button>
                                )}

                                {/* Sound Toggle */}
                                <button
                                  type="button"
                                  onClick={() => {
                                    setShowDesktopHeaderMenu(false);
                                    const next = !chatSoundMuted;
                                    setChatSoundMuted(next);
                                    if (typeof localStorage !== 'undefined') localStorage.setItem('elite_chat_sound_muted', String(next));
                                  }}
                                  style={{
                                    display: 'flex', alignItems: 'center', gap: '8px', padding: '8px 12px',
                                    background: 'transparent', border: 'none', borderRadius: '6px', textAlign: 'left',
                                    fontSize: '0.8rem', color: 'var(--text-primary)', cursor: 'pointer', fontWeight: 600
                                  }}
                                >
                                  {chatSoundMuted ? <Volume2 size={14} color="#10b981" /> : <VolumeX size={14} color="#ef4444" />}
                                  <span>{chatSoundMuted ? 'Unmute Sound' : 'Mute Sound'}</span>
                                </button>

                                {/* Export Chat Log */}
                                <button
                                  type="button"
                                  onClick={() => { setShowDesktopHeaderMenu(false); handleExportChatLog(); }}
                                  style={{
                                    display: 'flex', alignItems: 'center', gap: '8px', padding: '8px 12px',
                                    background: 'transparent', border: 'none', borderRadius: '6px', textAlign: 'left',
                                    fontSize: '0.8rem', color: 'var(--text-primary)', cursor: 'pointer', fontWeight: 600
                                  }}
                                >
                                  <FileText size={14} color="#8b5cf6" />
                                  <span>Export Chat Log</span>
                                </button>

                                {/* Admin Delete */}
                                {currentUser?.role === 'admin' && (
                                  <>
                                    <div style={{ height: '1px', background: 'var(--border-light, #e2e8f0)', margin: '4px 0' }} />
                                    <button
                                      type="button"
                                      onClick={() => { setShowDesktopHeaderMenu(false); handleDeleteGroup(activeGroup); }}
                                      style={{
                                        display: 'flex', alignItems: 'center', gap: '8px', padding: '8px 12px',
                                        background: '#fee2e2', border: 'none', borderRadius: '6px', textAlign: 'left',
                                        fontSize: '0.8rem', color: '#dc2626', cursor: 'pointer', fontWeight: 700
                                      }}
                                    >
                                      <Trash2 size={14} color="#dc2626" />
                                      <span>Delete Group</span>
                                    </button>
                                  </>
                                )}
                              </div>
                            </>
                          )}
                        </div>
                    </div>
                  </div>

                  </>
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
                onClick={() => setActiveMsgMenuId(null)}
                className="phoenix-chat-stream"
                style={{ flex: 1, overflowY: 'auto', padding: '0.75rem 1rem', display: 'flex', flexDirection: 'column', gap: '4px' }}
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
                              <span className="phoenix-date-badge">
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
                          <div style={{ display: 'flex', justifyContent: 'center', margin: '0.6rem 0', position: 'sticky', top: 4, zIndex: 10 }}>
                            <span className="phoenix-date-badge">
                              {msgDateHeader}
                            </span>
                          </div>
                        )}

                        <div
                          style={{
                            display: 'flex',
                            alignItems: 'flex-end',
                            gap: '8px',
                            alignSelf: isMe ? 'flex-end' : 'flex-start',
                            maxWidth: isMobileScreen ? '88%' : '75%',
                            marginBottom: '6px',
                            position: 'relative'
                          }}
                        >
                          {!isMe && (
                            <div
                              className="phoenix-avatar-wrap"
                              style={{
                                width: 34,
                                height: 34,
                                fontSize: '0.75rem',
                                flexShrink: 0,
                                marginBottom: '2px',
                                background: 'linear-gradient(135deg, #93c5fd 0%, #3b82f6 100%)',
                                color: '#ffffff',
                                border: 'none'
                              }}
                              title={msg.senderId?.name || msg.senderName || 'Staff Member'}
                            >
                              {(msg.senderId?.name || msg.senderName || 'S').charAt(0).toUpperCase()}
                            </div>
                          )}

                          <div
                            className={activeMsgMenuId === msg._id ? 'wa-msg-row menu-open' : 'wa-msg-row'}
                            style={{
                              position: 'relative',
                              display: 'flex',
                              flexDirection: 'column',
                              alignItems: isMe ? 'flex-end' : 'flex-start',
                              minWidth: 0,
                              flex: 1
                            }}
                          >
                            <div
                              className={isMe ? 'phoenix-bubble-sent' : 'phoenix-bubble-received'}
                              style={{
                                background: msg.priority === 'urgent'
                                  ? (isMe ? 'linear-gradient(135deg, #ef4444 0%, #b91c1c 100%)' : '#fee2e2')
                                  : (isMe ? '#3874ff' : 'var(--bg-card, #ffffff)'),
                                color: msg.priority === 'urgent'
                                  ? (isMe ? '#ffffff' : '#991b1b')
                                  : (isMe ? '#ffffff' : 'var(--text-primary, #141824)'),
                                padding: '12px 16px',
                                borderRadius: '8px',
                                border: msg.priority === 'urgent'
                                  ? (isMe ? '1.5px solid #fca5a5' : '1.5px solid #ef4444')
                                  : (isMe ? 'none' : '1px solid var(--border-light, #e3e6ed)'),
                                boxShadow: msg.priority === 'urgent'
                                  ? '0 3px 12px rgba(239,68,68,0.25)'
                                  : (isMe ? '0 2px 8px rgba(56, 116, 255, 0.2)' : '0 1px 2px rgba(0,0,0,0.03)'),
                                fontSize: '0.88rem',
                                lineHeight: 1.5,
                                wordBreak: 'break-word',
                                position: 'relative',
                                minWidth: '75px'
                              }}
                            >
                            {/* WhatsApp Down-Chevron Trigger */}
                            <button
                              type="button"
                              className="wa-bubble-trigger"
                              onClick={(e) => {
                                e.stopPropagation();
                                setActiveMsgMenuId(activeMsgMenuId === msg._id ? null : msg._id);
                              }}
                              style={{
                                position: 'absolute',
                                top: '3px',
                                right: '3px',
                                background: isMe ? 'rgba(255, 255, 255, 0.25)' : 'rgba(241, 245, 249, 0.95)',
                                border: 'none',
                                borderRadius: '50%',
                                width: '18px',
                                height: '18px',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                cursor: 'pointer',
                                color: isMe ? '#ffffff' : '#64748b',
                                boxShadow: '0 1px 2px rgba(0,0,0,0.12)',
                                zIndex: 4
                              }}
                              title="Message options"
                            >
                              <ChevronDown size={12} />
                            </button>

                            {/* WhatsApp Dropdown Action Menu */}
                            {activeMsgMenuId === msg._id && (
                              <div
                                style={{
                                  position: 'absolute',
                                  top: '24px',
                                  right: isMe ? 0 : 'auto',
                                  left: isMe ? 'auto' : 0,
                                  background: '#ffffff',
                                  borderRadius: '8px',
                                  boxShadow: '0 4px 18px rgba(0,0,0,0.18)',
                                  zIndex: 50,
                                  minWidth: '170px',
                                  padding: '4px 0',
                                  border: '1px solid #e2e8f0',
                                  animation: 'fadeIn 0.12s ease'
                                }}
                                onClick={(e) => e.stopPropagation()}
                              >
                                {/* Quick Reactions */}
                                <div style={{ display: 'flex', justifyContent: 'space-around', padding: '6px 8px', borderBottom: '1px solid #f1f5f9' }}>
                                  {['👍', '❤️', '😂', '😮', '😢', '🙏'].map((emo) => (
                                    <button
                                      key={emo}
                                      type="button"
                                      onClick={() => {
                                        handleToggleReaction(msg._id, emo);
                                        setActiveMsgMenuId(null);
                                      }}
                                      style={{ background: 'none', border: 'none', fontSize: '1rem', cursor: 'pointer', padding: '2px', transition: 'transform 0.1s' }}
                                    >
                                      {emo}
                                    </button>
                                  ))}
                                </div>

                                <button
                                  type="button"
                                  onClick={() => {
                                    setReplyToMessage(msg);
                                    setActiveMsgMenuId(null);
                                  }}
                                  style={{ width: '100%', display: 'flex', alignItems: 'center', gap: '8px', padding: '7px 12px', background: 'none', border: 'none', fontSize: '0.8rem', color: '#1e293b', cursor: 'pointer', textAlign: 'left' }}
                                >
                                  <Reply size={14} color="#2563eb" />
                                  <span>Reply</span>
                                </button>

                                <button
                                  type="button"
                                  onClick={() => {
                                    handleOpenForwardModal(msg);
                                    setActiveMsgMenuId(null);
                                  }}
                                  style={{ width: '100%', display: 'flex', alignItems: 'center', gap: '8px', padding: '7px 12px', background: 'none', border: 'none', fontSize: '0.8rem', color: '#1e293b', cursor: 'pointer', textAlign: 'left' }}
                                >
                                  <CornerUpRight size={14} color="#8b5cf6" />
                                  <span>Forward</span>
                                </button>

                                <button
                                  type="button"
                                  onClick={() => {
                                    handleTogglePin(msg._id);
                                    setActiveMsgMenuId(null);
                                  }}
                                  style={{ width: '100%', display: 'flex', alignItems: 'center', gap: '8px', padding: '7px 12px', background: 'none', border: 'none', fontSize: '0.8rem', color: '#1e293b', cursor: 'pointer', textAlign: 'left' }}
                                >
                                  {msg.isPinned ? <PinOff size={14} color="#d97706" /> : <Pin size={14} color="#64748b" />}
                                  <span>{msg.isPinned ? 'Unpin message' : 'Pin message'}</span>
                                </button>
                              </div>
                            )}

                            {/* Sender Name (only shown for others in group chats) */}
                            {!isMe && activeGroup?.type !== 'direct' && (
                              <div style={{ fontSize: '0.74rem', fontWeight: 700, color: '#2563eb', marginBottom: '2px', lineHeight: 1.2 }}>
                                {msg.senderId?.name || msg.senderName || 'Staff Member'}
                              </div>
                            )}

                            {/* Urgent SOS Alert Badge */}
                            {msg.priority === 'urgent' && (
                              <div style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', background: '#ef4444', color: '#ffffff', fontWeight: 800, fontSize: '0.62rem', padding: '1px 6px', borderRadius: '4px', marginBottom: '4px', animation: 'pulse 1.5s infinite' }}>
                                🚨 URGENT SOS
                              </div>
                            )}

                            {/* Forwarded Header (ONLY shown if legitimately forwarded, NOT for direct messages) */}
                            {msg.forwardedFrom && Boolean(msg.forwardedFrom.senderName && msg.forwardedFrom.senderName.trim()) && (
                              <div style={{ fontSize: '0.7rem', fontStyle: 'italic', color: isMe ? 'rgba(255,255,255,0.85)' : '#64748b', display: 'flex', alignItems: 'center', gap: '4px', marginBottom: '3px' }}>
                                <CornerUpRight size={12} style={{ transform: 'scaleX(-1)' }} />
                                <span>Forwarded</span>
                              </div>
                            )}

                            {/* Quoted Reply Card */}
                            {msg.replyTo && (
                              <div style={{ background: isMe ? 'rgba(255,255,255,0.15)' : 'rgba(37,99,235,0.06)', borderRadius: '5px', borderLeft: isMe ? '3.5px solid #ffffff' : '3.5px solid #2563eb', padding: '3px 8px', marginBottom: '4px', fontSize: '0.74rem' }}>
                                <div style={{ fontWeight: 700, color: isMe ? '#ffffff' : '#2563eb', fontSize: '0.7rem', marginBottom: '1px' }}>
                                  {typeof msg.replyTo.senderId === 'object' ? (msg.replyTo.senderId.name || msg.replyTo.senderId.username) : 'Staff Member'}
                                </div>
                                <div style={{ color: isMe ? 'rgba(255,255,255,0.9)' : '#64748b', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', fontSize: '0.72rem' }}>
                                  {msg.replyTo.content}
                                </div>
                              </div>
                            )}

                            {/* Interactive Poll Card */}
                            {isPollMsg && msg.pollMeta && (
                              <div style={{ minWidth: 240, maxWidth: 360, background: isMe ? 'rgba(255,255,255,0.15)' : '#f8fafc', borderRadius: '8px', padding: '0.6rem 0.75rem', border: isMe ? '1px solid rgba(255,255,255,0.25)' : '1px solid rgba(0,0,0,0.08)', marginBottom: '0.35rem' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '6px' }}>
                                  <BarChart2 size={16} color={isMe ? '#ffffff' : '#2563eb'} />
                                  <span style={{ fontSize: '0.85rem', fontWeight: 800, color: isMe ? '#ffffff' : '#1e293b' }}>{msg.pollMeta.question}</span>
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
                                              background: isMe ? 'rgba(255,255,255,0.2)' : '#ffffff',
                                              border: hasVoted ? (isMe ? '1.5px solid #ffffff' : '1.5px solid #2563eb') : (isMe ? '1px solid rgba(255,255,255,0.3)' : '1px solid #e2e8f0'),
                                              cursor: 'pointer',
                                              overflow: 'hidden',
                                              transition: 'all 0.15s ease'
                                            }}
                                          >
                                            <div
                                              style={{
                                                position: 'absolute',
                                                left: 0,
                                                top: 0,
                                                bottom: 0,
                                                width: `${pct}%`,
                                                background: isMe ? 'rgba(255,255,255,0.3)' : 'rgba(37,99,235,0.15)',
                                                transition: 'width 0.3s ease'
                                              }}
                                            />

                                            <div style={{ position: 'relative', zIndex: 1, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                              <span style={{ fontSize: '0.78rem', fontWeight: hasVoted ? 800 : 600, color: isMe ? '#ffffff' : '#1e293b' }}>
                                                {hasVoted ? '✓ ' : ''}{opt.text}
                                              </span>
                                              <span style={{ fontSize: '0.7rem', fontWeight: 800, opacity: 0.9, color: isMe ? '#ffffff' : '#1e293b' }}>
                                                {pct}% ({voteCount})
                                              </span>
                                            </div>
                                          </div>
                                        );
                                      })}

                                      <div style={{ fontSize: '0.64rem', opacity: 0.85, marginTop: '2px', textAlign: 'right', color: isMe ? '#ffffff' : '#64748b' }}>
                                        {totalVotes} total votes · {msg.pollMeta.isMultiSelect ? 'Multiple choice' : 'Single vote'}
                                      </div>
                                    </div>
                                  );
                                })()}
                              </div>
                            )}

                            {/* Audio Voice Player Card */}
                            {isAudioMsg && msg.attachment && msg.attachment.fileUrl && (
                              <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem', padding: '0.4rem 0.65rem', background: isMe ? 'rgba(255,255,255,0.18)' : 'rgba(37,99,235,0.06)', borderRadius: '10px', marginBottom: '0.35rem' }}>
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
                                  <div style={{ fontSize: '0.76rem', fontWeight: 800, display: 'flex', alignItems: 'center', gap: '4px', color: isMe ? '#ffffff' : '#0f172a' }}>
                                    <Volume2 size={13} />
                                    <span>Voice Note</span>
                                  </div>
                                  <div style={{ fontSize: '0.66rem', color: isMe ? 'rgba(255,255,255,0.85)' : '#64748b' }}>
                                    {msg.attachment.durationSec || 5} sec
                                  </div>
                                </div>
                              </div>
                            )}

                            {/* Quick Share Record Card */}
                            {isRecordCard && msg.activityMeta && msg.activityMeta.module && (() => {
                              const isJobCard = (msg.activityMeta.module || '').toLowerCase().includes('job') ||
                                                (msg.activityMeta.recordRef || '').toUpperCase().startsWith('JC-');
                              const cardData = msg.activityMeta.recordData;

                              return (
                                <div
                                  onClick={() => handleRecordClick(msg.activityMeta, cardData)}
                                  style={{
                                    background: isMe ? 'rgba(255,255,255,0.92)' : '#f8fafc',
                                    color: '#1e293b',
                                    padding: '0.55rem 0.75rem',
                                    borderRadius: '8px',
                                    border: '1px solid rgba(0,0,0,0.08)',
                                    boxShadow: '0 1px 4px rgba(0,0,0,0.05)',
                                    marginBottom: '0.4rem',
                                    cursor: 'pointer',
                                    transition: 'all 0.18s ease',
                                  }}
                                >
                                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '6px', marginBottom: '4px' }}>
                                    <span
                                      style={{
                                        fontSize: '0.68rem',
                                        fontWeight: 800,
                                        color: '#1d4ed8',
                                        background: '#eff6ff',
                                        padding: '2px 7px',
                                        borderRadius: '4px',
                                        textTransform: 'uppercase',
                                        display: 'inline-flex',
                                        alignItems: 'center',
                                        gap: '4px',
                                      }}
                                    >
                                      {isJobCard ? '📄 JOB CARD PDF' : `🃏 ${msg.activityMeta.module}`}
                                    </span>
                                    <button
                                      type="button"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        handleRecordClick(msg.activityMeta, cardData);
                                      }}
                                      style={{
                                        background: '#2563eb',
                                        color: '#ffffff',
                                        border: 'none',
                                        padding: '3px 9px',
                                        borderRadius: '5px',
                                        fontSize: '0.7rem',
                                        fontWeight: 800,
                                        cursor: 'pointer',
                                        display: 'inline-flex',
                                        alignItems: 'center',
                                        gap: '4px',
                                        boxShadow: '0 1px 4px rgba(0,0,0,0.12)',
                                      }}
                                    >
                                      {isJobCard ? <FileText size={11} /> : null}
                                      <span>{isJobCard ? 'View PDF' : 'Open →'}</span>
                                    </button>
                                  </div>

                                  <div style={{ fontSize: '0.84rem', fontWeight: 800, color: '#1e293b' }}>
                                    {msg.activityMeta.recordRef || msg.content}
                                  </div>

                                  {cardData && (
                                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '5px', fontSize: '0.7rem', opacity: 0.9, marginTop: '4px' }}>
                                      {cardData.party && (
                                        <span style={{ background: '#f1f5f9', padding: '1px 6px', borderRadius: '4px' }}>
                                          👤 {cardData.party}
                                        </span>
                                      )}
                                      {cardData.totalMtr && (
                                        <span style={{ background: '#f1f5f9', padding: '1px 6px', borderRadius: '4px' }}>
                                          📏 {cardData.totalMtr} Mtr
                                        </span>
                                      )}
                                      {cardData.machineName && (
                                        <span style={{ background: '#f1f5f9', padding: '1px 6px', borderRadius: '4px' }}>
                                          ⚙️ {cardData.machineName}
                                        </span>
                                      )}
                                    </div>
                                  )}

                                  {isJobCard && (
                                    <div
                                      style={{
                                        fontSize: '0.68rem',
                                        color: '#64748b',
                                        marginTop: '5px',
                                        paddingTop: '4px',
                                        borderTop: '1px solid #f1f5f9',
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: '4px',
                                      }}
                                    >
                                      <span>Tap to preview printable sheet & design</span>
                                    </div>
                                  )}
                                </div>
                              );
                            })()}

                            {/* Image Attachment */}
                            {msg.attachment && msg.attachment.fileUrl && !isAudioMsg && (
                              <div style={{ marginBottom: '0.35rem' }}>
                                {msg.attachment.fileType === 'image' ? (
                                  <img
                                    src={msg.attachment.fileUrl}
                                    alt="Attachment"
                                    onClick={() => setZoomImg(msg.attachment.fileUrl)}
                                    style={{ maxWidth: '100%', maxHeight: '240px', borderRadius: '6px', cursor: 'zoom-in', objectFit: 'cover' }}
                                  />
                                ) : (
                                  <a
                                    href={msg.attachment.fileUrl}
                                    download={msg.attachment.fileName}
                                    style={{ color: isMe ? '#ffffff' : '#2563eb', fontWeight: 700, fontSize: '0.78rem', display: 'flex', alignItems: 'center', gap: '4px', textDecoration: 'underline' }}
                                  >
                                    <FileText size={14} /> {msg.attachment.fileName}
                                  </a>
                                )}
                              </div>
                            )}

                            {/* Text Content + Inline Timestamp & Read Ticks */}
                            <div style={{ fontSize: '0.88rem', lineHeight: '1.42', color: 'inherit' }}>
                              {!isPollMsg && renderContentWithMentions(msg.content)}
                            </div>
                          </div>

                          {/* Phoenix Timestamp & Status below bubble */}
                          <div
                            style={{
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: isMe ? 'flex-end' : 'flex-start',
                              gap: '4px',
                              marginTop: '3px',
                              fontSize: '0.72rem',
                              color: 'var(--text-muted, #9aa5b8)',
                              fontWeight: 600,
                              userSelect: 'none',
                              width: '100%',
                              paddingLeft: isMe ? 0 : '4px',
                              paddingRight: isMe ? '4px' : 0
                            }}
                          >
                            {msg.isPinned && <Pin size={10} color="#d97706" style={{ transform: 'rotate(45deg)' }} />}
                            <span>{formatTime(msg.createdAt)}</span>
                            {isMe && (() => {
                              const myIdStr = String(currentUser?._id || currentUser?.id || '');
                              const isRead = Boolean(
                                msg.readBy &&
                                msg.readBy.some((u) => {
                                  const uId = String(typeof u === 'object' ? (u._id || u.id) : u);
                                  return uId && uId !== myIdStr;
                                })
                              );

                              return isRead ? (
                                <CheckCheck
                                  size={13}
                                  color="#3874ff"
                                  style={{ strokeWidth: 2.4, marginLeft: '2px' }}
                                  title="Read by recipient"
                                />
                              ) : (
                                <Check
                                  size={12}
                                  color="#9aa5b8"
                                  style={{ strokeWidth: 2, marginLeft: '2px' }}
                                  title="Sent"
                                />
                              );
                            })()}
                          </div>

                          {/* Existing Reaction Badges (WhatsApp Style Overlapping Pill) */}
                          {msg.reactions && (
                            <div style={{
                              display: 'flex',
                              flexWrap: 'wrap',
                              gap: '3px',
                              marginTop: '2px',
                              marginBottom: '-2px',
                              alignSelf: isMe ? 'flex-end' : 'flex-start'
                            }}>
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
                                  style={{
                                    fontSize: '0.72rem',
                                    background: '#ffffff',
                                    border: '1px solid #e2e8f0',
                                    borderRadius: '10px',
                                    padding: '1px 5px',
                                    cursor: 'pointer',
                                    display: 'inline-flex',
                                    alignItems: 'center',
                                    gap: '3px',
                                    boxShadow: '0 1px 3px rgba(0,0,0,0.08)'
                                  }}
                                >
                                  <span>{emoji}</span>
                                  {count > 1 && <span style={{ fontWeight: 800, fontSize: '0.64rem', color: '#64748b' }}>{count}</span>}
                                </span>
                              ))}
                            </div>
                          )}

                          {/* Desktop Hover Action Floating Bar */}
                          {!isMobileScreen && (
                            <div
                              className="wa-hover-actions"
                              style={{
                                position: 'absolute',
                                top: '2px',
                                [isMe ? 'left' : 'right']: '-66px',
                                display: 'flex',
                                gap: '2px',
                                background: 'rgba(255,255,255,0.95)',
                                backdropFilter: 'blur(4px)',
                                border: '1px solid #e2e8f0',
                                borderRadius: '16px',
                                padding: '2px 4px',
                                boxShadow: '0 2px 8px rgba(0,0,0,0.12)',
                                zIndex: 10
                              }}
                            >
                              <button
                                type="button"
                                onClick={() => setReplyToMessage(msg)}
                                style={{ background: 'none', border: 'none', color: '#54656f', cursor: 'pointer', padding: '3px', display: 'flex', alignItems: 'center' }}
                                title="Reply"
                              >
                                <Reply size={13} />
                              </button>
                              <button
                                type="button"
                                onClick={() => handleOpenForwardModal(msg)}
                                style={{ background: 'none', border: 'none', color: '#54656f', cursor: 'pointer', padding: '3px', display: 'flex', alignItems: 'center' }}
                                title="Forward"
                              >
                                <CornerUpRight size={13} />
                              </button>
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setActiveMsgMenuId(activeMsgMenuId === msg._id ? null : msg._id);
                                }}
                                style={{ background: 'none', border: 'none', color: '#54656f', cursor: 'pointer', padding: '3px', display: 'flex', alignItems: 'center' }}
                                title="More"
                              >
                                <MoreVertical size={13} />
                              </button>
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

              {/* Hidden File Input *              {/* Chat Input Form (Phoenix 1:1 Unified Desktop & Mobile) */}
              <form
                onSubmit={handleSendMessage}
                style={{
                  padding: isMobileScreen ? '0.65rem 0.85rem' : '0.75rem 1.15rem',
                  background: 'var(--bg-card, #ffffff)',
                  borderTop: '1px solid var(--border-light, #e3e6ed)',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '8px',
                  flexShrink: 0,
                  position: 'relative'
                }}
              >
                {isRecordingAudio ? (
                  <div style={{
                    width: '100%',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    background: slideCancelActive ? '#fef2f2' : '#fee2e2',
                    border: slideCancelActive ? '1.5px dashed #ef4444' : '1px solid #fca5a5',
                    padding: '0.45rem 0.85rem',
                    borderRadius: '8px',
                    color: '#b91c1c',
                    fontWeight: 800,
                    fontSize: '0.82rem',
                    transition: 'all 0.15s ease'
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                      <span style={{ width: 10, height: 10, borderRadius: '50%', background: '#ef4444' }} />
                      <span>{slideCancelActive ? 'Release to Cancel ✕' : `Recording... ${String(Math.floor(recordingSeconds / 60)).padStart(2, '0')}:${String(recordingSeconds % 60).padStart(2, '0')}`}</span>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem' }}>
                      <button type="button" onClick={cancelAudioRecording} style={{ background: 'none', border: 'none', color: '#dc2626', fontWeight: 700, cursor: 'pointer', fontSize: '0.78rem' }}>Cancel</button>
                      <button
                        type="button"
                        onClick={() => stopAudioRecording(true)}
                        style={{
                          background: '#3874ff',
                          color: '#ffffff',
                          border: 'none',
                          padding: '0.3rem 0.75rem',
                          borderRadius: '6px',
                          fontWeight: 800,
                          cursor: 'pointer',
                          fontSize: '0.78rem',
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '4px'
                        }}
                      >
                        <Send size={12} color="#ffffff" strokeWidth={2.5} />
                        <span>Send Now</span>
                      </button>
                    </div>
                  </div>
                ) : (
                  <>
                    {/* Top Row: Clean input / textarea matching Phoenix */}
                    <div style={{ width: '100%' }}>
                      <textarea
                        rows={isMobileScreen ? 1 : 2}
                        placeholder={isUrgent ? "🚨 Urgent SOS Message..." : "Type your message..."}
                        value={inputMessage}
                        onPaste={handlePasteClipboard}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' && !e.shiftKey) {
                            e.preventDefault();
                            handleSendMessage(e);
                          }
                        }}
                        onFocus={() => {
                          setTimeout(() => {
                            chatBottomRef.current?.scrollIntoView({ behavior: 'smooth' });
                          }, 250);
                        }}
                        onChange={(e) => {
                          const val = e.target.value;
                          setInputMessage(val);
                          if (activeGroup?._id) {
                            setRoomDrafts((prev) => ({ ...prev, [activeGroup._id]: val }));
                          }
                        }}
                        style={{
                          width: '100%',
                          background: 'transparent',
                          border: 'none',
                          outline: 'none',
                          resize: 'none',
                          fontSize: isMobileScreen ? '16px' : '0.875rem',
                          color: 'var(--text-primary, #141824)',
                          padding: '2px 0',
                          boxSizing: 'border-box',
                          fontFamily: 'inherit',
                          lineHeight: 1.45,
                          maxHeight: '120px'
                        }}
                      />
                    </div>

                    {/* Bottom Row: Tool icons on left, Phoenix Send button on right */}
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: isMobileScreen ? '6px' : '10px' }}>
                        {/* Smile / Emoji */}
                        <button
                          type="button"
                          className="phoenix-toolbar-icon"
                          title="Emoji"
                          onClick={() => setInputMessage((prev) => prev + ' 😊')}
                        >
                          <Smile size={18} />
                        </button>

                        {/* Image upload */}
                        <button
                          type="button"
                          className="phoenix-toolbar-icon"
                          onClick={() => {
                            if (fileInputRef.current) {
                              fileInputRef.current.accept = 'image/*';
                              fileInputRef.current.click();
                            }
                          }}
                          title="Upload Image"
                        >
                          <ImageIcon size={18} />
                        </button>

                        {/* Attachment / Paperclip */}
                        <button
                          type="button"
                          className="phoenix-toolbar-icon"
                          onClick={() => {
                            if (fileInputRef.current) {
                              fileInputRef.current.accept = 'image/*,.pdf,.doc,.docx,audio/*';
                              fileInputRef.current.click();
                            }
                          }}
                          title="Attach Document"
                        >
                          <Paperclip size={18} />
                        </button>

                        {/* Mic Voice Note */}
                        <button
                          type="button"
                          className="phoenix-toolbar-icon"
                          onMouseDown={handlePushToTalkStart}
                          onMouseUp={handlePushToTalkEnd}
                          onTouchStart={handlePushToTalkStart}
                          onTouchEnd={handlePushToTalkEnd}
                          onClick={(e) => {
                            e.preventDefault();
                            if (!isRecordingAudio && !isPushToTalkRef.current) {
                              startAudioRecording();
                            }
                          }}
                          title="Voice Note"
                        >
                          <Mic size={18} />
                        </button>

                        {/* More tools popover (Polls, Tasks, Job Cards, SOS) */}
                        <div style={{ position: 'relative' }}>
                          <button
                            type="button"
                            className="phoenix-toolbar-icon"
                            onClick={() => setShowMobileActionMenu(!showMobileActionMenu)}
                            style={{
                              background: showMobileActionMenu ? 'var(--nav-active-bg, #edf2f9)' : 'transparent',
                              color: showMobileActionMenu ? '#3874ff' : 'var(--text-muted, #748194)'
                            }}
                            title="More Tools"
                          >
                            <MoreHorizontal size={18} />
                          </button>

                          {showMobileActionMenu && (
                            <>
                              <div
                                onClick={() => setShowMobileActionMenu(false)}
                                style={{ position: 'fixed', inset: 0, zIndex: 9998, background: 'transparent' }}
                              />
                              <div style={{
                                position: 'absolute',
                                bottom: 'calc(100% + 8px)',
                                left: 0,
                                background: 'var(--bg-card, #ffffff)',
                                border: '1px solid var(--border-light, #e2e8f0)',
                                borderRadius: '12px',
                                boxShadow: '0 10px 25px rgba(0,0,0,0.15)',
                                zIndex: 9999,
                                padding: '6px',
                                minWidth: '210px',
                                display: 'flex',
                                flexDirection: 'column',
                                gap: '2px'
                              }}>
                                <button
                                  type="button"
                                  onClick={() => { setShowMobileActionMenu(false); setIsUrgent(!isUrgent); }}
                                  style={{
                                    display: 'flex', alignItems: 'center', gap: '8px', padding: '8px 12px',
                                    background: isUrgent ? '#fee2e2' : 'transparent', border: 'none', borderRadius: '6px', textAlign: 'left',
                                    fontSize: '0.8rem', color: isUrgent ? '#dc2626' : 'var(--text-primary)', cursor: 'pointer', fontWeight: 600
                                  }}
                                >
                                  <AlertTriangle size={14} color="#dc2626" />
                                  <span>{isUrgent ? 'Disable Urgent Alert' : 'Mark as Urgent (SOS)'}</span>
                                </button>

                                <button
                                  type="button"
                                  onClick={() => { setShowMobileActionMenu(false); handleOpenShareModal('jobcard'); }}
                                  style={{
                                    display: 'flex', alignItems: 'center', gap: '8px', padding: '8px 12px',
                                    background: 'transparent', border: 'none', borderRadius: '6px', textAlign: 'left',
                                    fontSize: '0.8rem', color: 'var(--text-primary)', cursor: 'pointer', fontWeight: 600
                                  }}
                                >
                                  <Share2 size={14} color="#8b5cf6" />
                                  <span>Quick Share Record</span>
                                </button>

                                <button
                                  type="button"
                                  onClick={() => { setShowMobileActionMenu(false); setShowPollModal(true); }}
                                  style={{
                                    display: 'flex', alignItems: 'center', gap: '8px', padding: '8px 12px',
                                    background: 'transparent', border: 'none', borderRadius: '6px', textAlign: 'left',
                                    fontSize: '0.8rem', color: 'var(--text-primary)', cursor: 'pointer', fontWeight: 600
                                  }}
                                >
                                  <BarChart2 size={14} color="#059669" />
                                  <span>Create Poll</span>
                                </button>

                                <button
                                  type="button"
                                  onClick={() => { setShowMobileActionMenu(false); handleOpenTaskModalFromChat(); }}
                                  style={{
                                    display: 'flex', alignItems: 'center', gap: '8px', padding: '8px 12px',
                                    background: 'transparent', border: 'none', borderRadius: '6px', textAlign: 'left',
                                    fontSize: '0.8rem', color: 'var(--text-primary)', cursor: 'pointer', fontWeight: 600
                                  }}
                                >
                                  <CheckSquare size={14} color="#10b981" />
                                  <span>Create Task</span>
                                </button>
                              </div>
                            </>
                          )}
                        </div>

                        {isUrgent && (
                          <span style={{ fontSize: '0.65rem', fontWeight: 900, background: '#ef4444', color: '#fff', padding: '2px 6px', borderRadius: '4px' }}>
                            SOS ACTIVE
                          </span>
                        )}
                      </div>

                      {/* Phoenix Send Button */}
                      <button
                        type="submit"
                        disabled={!inputMessage.trim() && !attachedFile}
                        className="phoenix-send-btn"
                      >
                        <span>Send</span>
                        <Send size={13} style={{ transform: 'rotate(0deg)' }} />
                      </button>
                    </div>
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

      {/* ── JOB CARD PDF VIEW MODAL ── */}
      {pdfPreviewCard && (
        <JobCardPdfModal
          card={pdfPreviewCard}
          loading={pdfPreviewLoading}
          error={pdfPreviewError}
          onClose={() => setPdfPreviewCard(null)}
          onNavigateToJobCards={onNavigateTab ? () => {
            setPdfPreviewCard(null);
            onNavigateTab('jobcards');
          } : null}
        />
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

      {/* ─── CALL SUITE ANIMATIONS & STYLES ─── */}
      <style>{`
        @keyframes callRipple {
          0% { transform: scale(0.95); opacity: 0.8; }
          50% { transform: scale(1.15); opacity: 0.3; }
          100% { transform: scale(1.35); opacity: 0; }
        }
        @keyframes bannerSlideDown {
          0% { transform: translate(-50%, -120%); opacity: 0; }
          100% { transform: translate(-50%, 0); opacity: 1; }
        }
        .call-ctrl-btn {
          width: 50px;
          height: 50px;
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          cursor: pointer;
          transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
          border: 1px solid rgba(255, 255, 255, 0.16);
          background: rgba(255, 255, 255, 0.1);
          color: #ffffff;
        }
        .call-ctrl-btn:hover {
          transform: translateY(-2px) scale(1.06);
          background: rgba(255, 255, 255, 0.2);
        }
        .call-ctrl-btn.active-danger {
          background: #ef4444;
          border-color: #f87171;
          color: #ffffff;
        }
        .call-ctrl-btn.active-primary {
          background: #3874ff;
          border-color: #60a5fa;
          color: #ffffff;
        }
        .call-ctrl-btn.end-call {
          width: 54px;
          height: 54px;
          background: linear-gradient(135deg, #ef4444, #dc2626);
          border-color: #f87171;
          box-shadow: 0 8px 20px rgba(239, 68, 68, 0.45);
        }
        .call-ctrl-btn.end-call:hover {
          background: #b91c1c;
          transform: translateY(-2px) scale(1.08);
        }
        .dialpad-btn {
          width: 60px;
          height: 44px;
          border-radius: 10px;
          background: rgba(255, 255, 255, 0.08);
          border: 1px solid rgba(255, 255, 255, 0.12);
          color: #fff;
          font-size: 1.1rem;
          font-weight: 700;
          cursor: pointer;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          transition: all 0.15s ease;
        }
        .dialpad-btn:hover {
          background: rgba(255, 255, 255, 0.22);
          transform: scale(1.05);
        }
      `}</style>

      {/* ─── INCOMING CALL BANNER / NOTIFICATION ─── */}
      {incomingCall && (
        <div style={{
          position: 'fixed',
          top: '24px',
          left: '50%',
          transform: 'translateX(-50%)',
          zIndex: 99999,
          animation: 'bannerSlideDown 0.35s cubic-bezier(0.16, 1, 0.3, 1)',
          minWidth: '360px',
          maxWidth: '92vw',
          background: 'linear-gradient(135deg, rgba(15, 23, 42, 0.94), rgba(30, 41, 59, 0.96))',
          backdropFilter: 'blur(20px)',
          border: '1px solid rgba(56, 189, 248, 0.4)',
          boxShadow: '0 20px 40px -10px rgba(0,0,0,0.6), 0 0 25px rgba(56, 189, 248, 0.25)',
          borderRadius: '20px',
          padding: '16px 20px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '16px'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
            <div style={{
              width: '46px',
              height: '46px',
              borderRadius: '50%',
              background: 'linear-gradient(135deg, #3874ff, #06b6d4)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#fff',
              boxShadow: '0 0 15px rgba(56, 189, 248, 0.5)',
              position: 'relative'
            }}>
              {incomingCall.callType === 'video' ? <Video size={22} /> : <PhoneIncoming size={22} />}
              <span style={{
                position: 'absolute',
                inset: -4,
                borderRadius: '50%',
                border: '2px solid rgba(56, 189, 248, 0.6)',
                animation: 'callRipple 1.6s infinite ease-out'
              }} />
            </div>
            <div>
              <div style={{ fontSize: '0.96rem', fontWeight: 800, color: '#f8fafc', display: 'flex', alignItems: 'center', gap: '6px' }}>
                <span>{incomingCall.callerName || 'Team Member'}</span>
                <span style={{ fontSize: '0.68rem', padding: '2px 7px', borderRadius: '10px', background: 'rgba(56, 189, 248, 0.2)', color: '#38bdf8', fontWeight: 700 }}>
                  {incomingCall.callType === 'video' ? 'Video' : 'Voice'} Call
                </span>
              </div>
              <div style={{ fontSize: '0.78rem', color: '#94a3b8', marginTop: '2px' }}>
                Incoming call from Elite Enterprise...
              </div>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <button
              type="button"
              onClick={declineIncomingCall}
              title="Decline"
              style={{
                width: '42px',
                height: '42px',
                borderRadius: '50%',
                background: '#ef4444',
                border: 'none',
                color: '#fff',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                boxShadow: '0 4px 12px rgba(239, 68, 68, 0.4)',
                transition: 'transform 0.15s ease'
              }}
            >
              <PhoneOff size={18} />
            </button>
            <button
              type="button"
              onClick={answerIncomingCall}
              title="Accept"
              style={{
                width: '42px',
                height: '42px',
                borderRadius: '50%',
                background: '#10b981',
                border: 'none',
                color: '#fff',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                boxShadow: '0 4px 12px rgba(16, 185, 129, 0.4)',
                transition: 'transform 0.15s ease'
              }}
            >
              <Phone size={18} />
            </button>
          </div>
        </div>
      )}

      {/* ─── ACTIVE CALL MODAL (VOICE & VIDEO CALL SUITE) ─── */}
      {activeCall && (
        <div style={{
          position: 'fixed',
          inset: 0,
          zIndex: 99998,
          background: 'rgba(10, 15, 30, 0.88)',
          backdropFilter: 'blur(24px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '1rem',
          animation: 'fadeIn 0.25s ease-out'
        }}>
          <div style={{
            width: '100%',
            maxWidth: activeCall.type === 'video' ? '860px' : '460px',
            background: 'linear-gradient(135deg, rgba(20, 27, 45, 0.95), rgba(11, 15, 25, 0.98))',
            border: '1px solid rgba(255, 255, 255, 0.14)',
            borderRadius: '26px',
            boxShadow: '0 30px 60px -15px rgba(0,0,0,0.8), 0 0 50px rgba(56, 189, 248, 0.15)',
            overflow: 'hidden',
            display: 'flex',
            flexDirection: 'column',
            position: 'relative'
          }}>
            {/* Top Bar */}
            <div style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '16px 22px',
              borderBottom: '1px solid rgba(255, 255, 255, 0.08)',
              background: 'rgba(255, 255, 255, 0.02)'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span style={{
                  width: '8px',
                  height: '8px',
                  borderRadius: '50%',
                  background: activeCall.status === 'connected' ? '#10b981' : '#f59e0b',
                  boxShadow: activeCall.status === 'connected' ? '0 0 10px #10b981' : '0 0 10px #f59e0b'
                }} />
                <span style={{ fontSize: '0.8rem', fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.6px' }}>
                  {activeCall.type === 'video' ? 'HD Video Conference' : 'HD Voice Call'}
                </span>
                <span style={{ fontSize: '0.72rem', background: 'rgba(56, 189, 248, 0.15)', color: '#38bdf8', padding: '2px 8px', borderRadius: '12px', fontWeight: 600 }}>
                  Encrypted
                </span>
              </div>
              <button
                type="button"
                onClick={() => endCall(true)}
                style={{
                  background: 'rgba(255,255,255,0.06)',
                  border: 'none',
                  borderRadius: '8px',
                  width: '30px',
                  height: '30px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: '#94a3b8',
                  cursor: 'pointer'
                }}
              >
                <X size={16} />
              </button>
            </div>

            {/* Main Call Body */}
            {activeCall.type === 'voice' ? (
              /* VOICE CALL VIEW */
              <div style={{
                padding: '36px 24px 28px',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                position: 'relative'
              }}>
                {/* Concentric Pulsing Avatar Container */}
                <div style={{
                  position: 'relative',
                  width: '140px',
                  height: '140px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  marginBottom: '20px'
                }}>
                  {/* Outer Ripples */}
                  {activeCall.status === 'connected' && (
                    <>
                      <div style={{
                        position: 'absolute',
                        inset: -12 - (audioLevel * 0.25),
                        borderRadius: '50%',
                        border: '2px solid rgba(56, 189, 248, 0.4)',
                        opacity: Math.max(0.2, audioLevel / 100),
                        transition: 'all 0.15s ease'
                      }} />
                      <div style={{
                        position: 'absolute',
                        inset: -26 - (audioLevel * 0.4),
                        borderRadius: '50%',
                        border: '1.5px solid rgba(56, 189, 248, 0.2)',
                        opacity: Math.max(0.1, audioLevel / 150),
                        transition: 'all 0.15s ease'
                      }} />
                    </>
                  )}
                  {activeCall.status === 'calling' && (
                    <div style={{
                      position: 'absolute',
                      inset: -16,
                      borderRadius: '50%',
                      border: '2px solid rgba(56, 189, 248, 0.5)',
                      animation: 'callRipple 2s infinite ease-out'
                    }} />
                  )}

                  {/* Center Avatar */}
                  <div style={{
                    width: '110px',
                    height: '110px',
                    borderRadius: '50%',
                    background: 'linear-gradient(135deg, #2563eb, #3874ff)',
                    boxShadow: '0 12px 30px rgba(37, 99, 235, 0.45)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: '2.4rem',
                    fontWeight: 800,
                    color: '#ffffff',
                    border: '3px solid rgba(255, 255, 255, 0.25)',
                    zIndex: 2,
                    textTransform: 'uppercase'
                  }}>
                    {activeCall.recipientName.slice(0, 2)}
                  </div>
                </div>

                {/* Recipient Name & Status */}
                <h2 style={{ margin: '0 0 6px', fontSize: '1.45rem', fontWeight: 800, color: '#f8fafc', textAlign: 'center' }}>
                  {activeCall.recipientName}
                </h2>
                <div style={{
                  fontSize: '0.88rem',
                  fontWeight: 600,
                  color: activeCall.status === 'connected' ? '#10b981' : (activeCall.status === 'ended' ? '#ef4444' : '#38bdf8'),
                  marginBottom: '18px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px'
                }}>
                  {activeCall.status === 'calling' && 'Ringing...'}
                  {activeCall.status === 'connected' && `Connected (${formatDuration(callDuration)})`}
                  {activeCall.status === 'ended' && (activeCall.error || 'Call Ended')}
                </div>

                {/* Audio Waveform Equalizer */}
                {activeCall.status === 'connected' && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: '5px', height: '30px', marginBottom: '22px' }}>
                    {[12, 22, 16, 28, 18, 26, 14, 20].map((h, i) => (
                      <div
                        key={i}
                        style={{
                          width: '4px',
                          borderRadius: '3px',
                          background: 'linear-gradient(to top, #3874ff, #38bdf8)',
                          height: `${Math.max(6, Math.min(30, (h * (audioLevel + 30)) / 80))}px`,
                          transition: 'height 0.12s ease'
                        }}
                      />
                    ))}
                  </div>
                )}

                {/* Dialpad Overlay */}
                {showDialpad && (
                  <div style={{
                    width: '100%',
                    maxWidth: '280px',
                    background: 'rgba(15, 23, 42, 0.8)',
                    borderRadius: '16px',
                    padding: '14px',
                    border: '1px solid rgba(255,255,255,0.1)',
                    marginBottom: '18px'
                  }}>
                    <div style={{
                      minHeight: '32px',
                      background: 'rgba(0,0,0,0.3)',
                      borderRadius: '8px',
                      marginBottom: '10px',
                      padding: '4px 10px',
                      textAlign: 'center',
                      fontSize: '1.1rem',
                      fontWeight: 700,
                      color: '#38bdf8',
                      letterSpacing: '3px'
                    }}>
                      {dialpadDigits || '—'}
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '8px' }}>
                      {['1','2','3','4','5','6','7','8','9','*','0','#'].map((key) => (
                        <button
                          key={key}
                          type="button"
                          className="dialpad-btn"
                          onClick={() => setDialpadDigits((prev) => (prev.length < 16 ? prev + key : prev))}
                        >
                          {key}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            ) : (
              /* VIDEO CALL VIEW */
              <div style={{
                position: 'relative',
                width: '100%',
                height: '460px',
                background: '#090d16',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                overflow: 'hidden'
              }}>
                {/* Local Video Stream or Placeholder */}
                {activeCall.isVideoOff ? (
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '12px' }}>
                    <div style={{
                      width: '90px',
                      height: '90px',
                      borderRadius: '50%',
                      background: 'linear-gradient(135deg, #1e293b, #334155)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      color: '#94a3b8'
                    }}>
                      <VideoOff size={36} />
                    </div>
                    <div style={{ color: '#94a3b8', fontSize: '0.9rem', fontWeight: 600 }}>
                      Camera is Turned Off
                    </div>
                  </div>
                ) : (
                  <video
                    ref={localVideoRef}
                    autoPlay
                    playsInline
                    muted
                    style={{
                      width: '100%',
                      height: '100%',
                      objectFit: 'cover'
                    }}
                  />
                )}

                {/* Floating Top Pill Overlay */}
                <div style={{
                  position: 'absolute',
                  top: '16px',
                  left: '16px',
                  background: 'rgba(15, 23, 42, 0.75)',
                  backdropFilter: 'blur(12px)',
                  border: '1px solid rgba(255,255,255,0.12)',
                  borderRadius: '20px',
                  padding: '6px 14px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  color: '#fff',
                  zIndex: 3
                }}>
                  <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#10b981', display: 'inline-block' }} />
                  <span style={{ fontSize: '0.84rem', fontWeight: 700 }}>{activeCall.recipientName}</span>
                  <span style={{ fontSize: '0.74rem', color: '#94a3b8' }}>•</span>
                  <span style={{ fontSize: '0.78rem', color: '#38bdf8', fontWeight: 600 }}>
                    {activeCall.status === 'connected' ? formatDuration(callDuration) : 'Connecting...'}
                  </span>
                </div>

                {/* Floating Screen Share Badge */}
                {activeCall.isScreenSharing && (
                  <div style={{
                    position: 'absolute',
                    top: '16px',
                    right: '16px',
                    background: '#3874ff',
                    color: '#fff',
                    borderRadius: '16px',
                    padding: '6px 12px',
                    fontSize: '0.75rem',
                    fontWeight: 700,
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                    zIndex: 3
                  }}>
                    <Monitor size={14} /> Screen Sharing Active
                  </div>
                )}
              </div>
            )}

            {/* Bottom Controls Bar */}
            <div style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '14px',
              padding: '18px 24px',
              background: 'rgba(15, 23, 42, 0.7)',
              borderTop: '1px solid rgba(255, 255, 255, 0.08)'
            }}>
              {/* Mute Toggle */}
              <button
                type="button"
                className={`call-ctrl-btn ${activeCall.isMuted ? 'active-danger' : ''}`}
                onClick={toggleMute}
                title={activeCall.isMuted ? 'Unmute Microphone' : 'Mute Microphone'}
              >
                {activeCall.isMuted ? <MicOff size={20} /> : <Mic size={20} />}
              </button>

              {/* Video Toggle */}
              <button
                type="button"
                className={`call-ctrl-btn ${activeCall.isVideoOff ? 'active-danger' : (activeCall.type === 'video' ? 'active-primary' : '')}`}
                onClick={toggleVideo}
                title={activeCall.isVideoOff ? 'Turn Camera On' : 'Turn Camera Off'}
              >
                {activeCall.isVideoOff ? <VideoOff size={20} /> : <Video size={20} />}
              </button>

              {/* Screen Share */}
              <button
                type="button"
                className={`call-ctrl-btn ${activeCall.isScreenSharing ? 'active-primary' : ''}`}
                onClick={toggleScreenShare}
                title={activeCall.isScreenSharing ? 'Stop Screen Share' : 'Share Screen'}
              >
                {activeCall.isScreenSharing ? <MonitorOff size={20} /> : <Monitor size={20} />}
              </button>

              {/* Dialpad Toggle (Voice Call) */}
              {activeCall.type === 'voice' && (
                <button
                  type="button"
                  className={`call-ctrl-btn ${showDialpad ? 'active-primary' : ''}`}
                  onClick={() => setShowDialpad(!showDialpad)}
                  title="Toggle Keypad"
                >
                  <Grid size={20} />
                </button>
              )}

              {/* End Call Button */}
              <button
                type="button"
                className="call-ctrl-btn end-call"
                onClick={() => endCall(true)}
                title="End Call"
              >
                <PhoneOff size={22} color="#ffffff" />
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
