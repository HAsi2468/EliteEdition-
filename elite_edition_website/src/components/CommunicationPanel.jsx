import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import ReactDOM from 'react-dom';
import { api, getBaseUrl, getAccessToken, authFetch } from '../services/api';
import { useSocket } from '../contexts/SocketContext';
import socketManager from '../services/socketManager';
import TaskManagerPanel from './TaskManagerPanel';
import JobCardPdfModal from './JobCardPdfModal';
import ErrorBoundary from './common/ErrorBoundary';
import ToolResultDispatcher from './cards/ToolResultDispatcher';
import ChatContainer from './cards/ChatContainer';
import EmojiPickerPopover from './EmojiPickerPopover';
import { useFileUpload } from '../hooks/useFileUpload';
import '../styles/communication.css';
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
  AlertCircle,
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
  Calendar,
  Tag,
  PhoneMissed,
  Download,
  FileSpreadsheet,
  Edit3,
  ArrowLeft,
  ZoomIn,
  ZoomOut,
  RotateCw
} from 'lucide-react';

function formatFileSize(bytes) {
  if (!bytes || isNaN(bytes)) return '';
  const num = Number(bytes);
  if (num < 1024) return `${num} B`;
  if (num < 1024 * 1024) return `${(num / 1024).toFixed(1)} KB`;
  return `${(num / (1024 * 1024)).toFixed(1)} MB`;
}

const ICE_SERVERS = [
  { urls: 'stun:stun.l.google.com:19302' },
  { urls: 'stun:stun1.l.google.com:19302' },
  { urls: 'stun:stun2.l.google.com:19302' },
  { urls: 'stun:stun.cloudflare.com:3478' },
  {
    urls: 'turn:openrelay.metered.ca:80',
    username: 'openrelayproject',
    credential: 'openrelayproject'
  },
  {
    urls: 'turn:openrelay.metered.ca:443',
    username: 'openrelayproject',
    credential: 'openrelayproject'
  },
  {
    urls: 'turn:openrelay.metered.ca:443?transport=tcp',
    username: 'openrelayproject',
    credential: 'openrelayproject'
  }
];

function CsvDataViewer({ fileUrl, fileName }) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [data, setData] = useState({ headers: [], rows: [], totalRows: 0 });

  useEffect(() => {
    let active = true;
    setLoading(true);

    const loadCsv = async () => {
      let text = null;
      try {
        const res = await fetch(fileUrl);
        if (res.ok) {
          text = await res.text();
        }
      } catch (e) {
        // Direct fetch failed (e.g. CORS on r2.dev), fallback to download proxy
      }

      if (!text) {
        try {
          const proxyUrl = `/v1/upload/download?url=${encodeURIComponent(fileUrl)}&filename=${encodeURIComponent(fileName || 'file.csv')}`;
          const res = await authFetch(proxyUrl);
          if (res.ok) {
            text = await res.text();
          } else {
            throw new Error('Failed to load spreadsheet stream');
          }
        } catch (err) {
          if (!active) return;
          setError(err.message || 'Unable to load preview');
          setLoading(false);
          return;
        }
      }

      if (!active) return;
      const lines = text.split(/\r?\n/).filter((l) => l.trim().length > 0);
      if (lines.length === 0) {
        setData({ headers: ['(Empty File)'], rows: [], totalRows: 0 });
        setLoading(false);
        return;
      }

      const firstLine = lines[0];
      let delimiter = ',';
      if (firstLine.includes('\t')) delimiter = '\t';
      else if (firstLine.includes(';') && !firstLine.includes(',')) delimiter = ';';

      const parseLine = (line) => {
        const result = [];
        let cur = '';
        let inQuotes = false;
        for (let i = 0; i < line.length; i++) {
          const ch = line[i];
          if (ch === '"' || ch === "'") {
            inQuotes = !inQuotes;
          } else if (ch === delimiter && !inQuotes) {
            result.push(cur.trim());
            cur = '';
          } else {
            cur += ch;
          }
        }
        result.push(cur.trim());
        return result;
      };

      const headers = parseLine(lines[0]);
      const rows = lines.slice(1, 101).map((l) => parseLine(l));
      setData({ headers, rows, totalRows: lines.length - 1 });
      setLoading(false);
    };

    loadCsv();
    return () => { active = false; };
  }, [fileUrl, fileName]);

  if (loading) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', color: '#94a3b8', gap: '10px' }}>
        <div style={{ width: 28, height: 28, border: '3px solid rgba(255,255,255,0.2)', borderTopColor: '#3874ff', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
        <span style={{ fontSize: '0.85rem' }}>Reading spreadsheet data...</span>
      </div>
    );
  }

  if (error) {
    return (
      <div style={{ padding: '2rem', textAlign: 'center', color: '#f87171' }}>
        <p style={{ margin: 0, fontWeight: 700 }}>Could not preview spreadsheet.</p>
        <p style={{ fontSize: '0.8rem', opacity: 0.8, marginTop: '4px' }}>Please use the Download button above to open this file.</p>
      </div>
    );
  }

  return (
    <div style={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column', background: '#ffffff', borderRadius: '8px', overflow: 'hidden' }}>
      <div style={{ padding: '8px 14px', background: '#f8fafc', borderBottom: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.75rem', color: '#64748b', fontWeight: 600 }}>
        <span>Showing first {Math.min(50, data.rows.length)} rows {data.totalRows > 50 ? `(of ${data.totalRows} total)` : ''}</span>
        <span style={{ color: '#059669', fontWeight: 700 }}>● Live Table Preview</span>
      </div>
      <div style={{ flex: 1, overflow: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.8rem', textAlign: 'left' }}>
          <thead>
            <tr style={{ background: '#f1f5f9', position: 'sticky', top: 0, zIndex: 2 }}>
              <th style={{ padding: '7px 10px', borderBottom: '1px solid #cbd5e1', borderRight: '1px solid #e2e8f0', width: '40px', color: '#64748b', fontSize: '0.7rem' }}>#</th>
              {data.headers.map((h, i) => (
                <th key={i} style={{ padding: '7px 12px', borderBottom: '1px solid #cbd5e1', borderRight: '1px solid #e2e8f0', fontWeight: 700, color: '#1e293b', whiteSpace: 'nowrap' }}>
                  {h || `Col ${i + 1}`}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {data.rows.map((row, rIdx) => (
              <tr key={rIdx} style={{ background: rIdx % 2 === 0 ? '#ffffff' : '#f8fafc', borderBottom: '1px solid #f1f5f9' }}>
                <td style={{ padding: '6px 10px', borderRight: '1px solid #e2e8f0', color: '#94a3b8', fontSize: '0.7rem', fontWeight: 600 }}>{rIdx + 1}</td>
                {data.headers.map((_, cIdx) => (
                  <td key={cIdx} style={{ padding: '6px 12px', borderRight: '1px solid #f1f5f9', color: '#334155', whiteSpace: 'nowrap' }}>
                    {row[cIdx] !== undefined ? row[cIdx] : ''}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function TextFileViewer({ fileUrl, fileName }) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [content, setContent] = useState('');
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    let active = true;
    setLoading(true);

    const loadText = async () => {
      let text = null;
      try {
        const res = await fetch(fileUrl);
        if (res.ok) text = await res.text();
      } catch (e) {
        // Direct fetch failed, fallback to proxy
      }

      if (text === null) {
        try {
          const proxyUrl = `/v1/upload/download?url=${encodeURIComponent(fileUrl)}&filename=${encodeURIComponent(fileName || 'file.txt')}`;
          const res = await authFetch(proxyUrl);
          if (res.ok) {
            text = await res.text();
          } else {
            throw new Error('Failed to load text preview');
          }
        } catch (err) {
          if (!active) return;
          setError(err.message || 'Unable to preview text');
          setLoading(false);
          return;
        }
      }

      if (!active) return;
      setContent(text || '');
      setLoading(false);
    };

    loadText();
    return () => { active = false; };
  }, [fileUrl, fileName]);

  const handleCopy = () => {
    if (navigator?.clipboard?.writeText) {
      navigator.clipboard.writeText(content);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  if (loading) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', color: '#94a3b8', gap: '10px' }}>
        <div style={{ width: 28, height: 28, border: '3px solid rgba(255,255,255,0.2)', borderTopColor: '#3874ff', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
        <span style={{ fontSize: '0.85rem' }}>Loading text document...</span>
      </div>
    );
  }

  if (error) {
    return (
      <div style={{ padding: '2rem', textAlign: 'center', color: '#f87171' }}>
        <p style={{ margin: 0, fontWeight: 700 }}>Could not preview text document.</p>
        <p style={{ fontSize: '0.8rem', opacity: 0.8, marginTop: '4px' }}>Please use the Download button above to open this file.</p>
      </div>
    );
  }

  const lineCount = content ? content.split('\n').length : 0;

  return (
    <div style={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column', background: '#0f172a', borderRadius: '8px', overflow: 'hidden', color: '#e2e8f0' }}>
      <div style={{ padding: '8px 14px', background: '#1e293b', borderBottom: '1px solid #334155', display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.75rem', fontWeight: 600 }}>
        <span style={{ color: '#94a3b8' }}>{fileName} • {content.length} characters • {lineCount} line{lineCount !== 1 ? 's' : ''}</span>
        <button
          type="button"
          onClick={handleCopy}
          style={{ background: copied ? '#059669' : '#334155', color: '#ffffff', border: 'none', padding: '4px 10px', borderRadius: '4px', fontSize: '0.72rem', cursor: 'pointer', fontWeight: 600, transition: 'background 0.2s' }}
        >
          {copied ? '✓ Copied' : 'Copy Text'}
        </button>
      </div>
      <div style={{ flex: 1, overflow: 'auto', padding: '16px' }}>
        <pre style={{ margin: 0, fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace', fontSize: '0.82rem', lineHeight: '1.5', whiteSpace: 'pre-wrap', wordBreak: 'break-word', color: '#f1f5f9' }}>
          {content}
        </pre>
      </div>
    </div>
  );
}

// Unified Message Deduplication & Monotonic Ordering Helper
const mergeMessages = (prev = [], incoming = []) => {
  const map = new Map();
  const clientMsgIdMap = new Map();
  const signatureMap = new Map();

  const getSignature = (m) => {
    if (!m) return '';
    const sId = typeof m.senderId === 'object' ? (m.senderId?._id || m.senderId?.id) : m.senderId;
    const time = m.createdAt ? new Date(m.createdAt).toISOString().slice(0, 19) : '';
    const content = (m.content || '').trim().slice(0, 80);
    return `${sId}_${time}_${content}`;
  };

  const processMsg = (m) => {
    if (!m) return;
    const id = m._id ? String(m._id) : null;
    const cId = m.clientMsgId ? String(m.clientMsgId) : null;
    const sig = getSignature(m);

    let matchedKey = null;
    if (id && map.has(id)) {
      matchedKey = id;
    } else if (cId && clientMsgIdMap.has(cId)) {
      matchedKey = clientMsgIdMap.get(cId);
    } else if (sig && signatureMap.has(sig)) {
      matchedKey = signatureMap.get(sig);
    }

    if (matchedKey && map.has(matchedKey)) {
      const existing = map.get(matchedKey);
      const isExistingTemp = existing.isOptimistic || String(existing._id).startsWith('temp_');
      const isNewReal = !m.isOptimistic && !String(m._id).startsWith('temp_');

      if (isExistingTemp && isNewReal) {
        map.delete(matchedKey);
        map.set(id || matchedKey, { ...existing, ...m, isOptimistic: false });
      } else {
        map.set(matchedKey, { ...existing, ...m });
      }
    } else {
      const key = id || cId || `temp_${Math.random()}`;
      map.set(key, m);
      if (cId) clientMsgIdMap.set(cId, key);
      if (sig) signatureMap.set(sig, key);
    }
  };

  for (const m of (prev || [])) processMsg(m);
  for (const m of (incoming || [])) processMsg(m);

  return Array.from(map.values()).sort((a, b) => {
    if (a.roomSeq != null && b.roomSeq != null && a.roomSeq !== b.roomSeq) {
      return a.roomSeq - b.roomSeq;
    }
    const timeA = new Date(a.createdAt || 0).getTime();
    const timeB = new Date(b.createdAt || 0).getTime();
    if (timeA !== timeB) return timeA - timeB;
    return String(a._id || '').localeCompare(String(b._id || ''));
  });
};

export default function CommunicationPanel({ currentUser, onNavigateTab, initialMainTab = 'chat', activeTab = 'communication', onUnreadChange }) {
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
  const [messageSearchResults, setMessageSearchResults] = useState([]);
  const [isSearchingMessages, setIsSearchingMessages] = useState(false);
  const [streamHistoryError, setStreamHistoryError] = useState(null);
  const [showCopilotModal, setShowCopilotModal] = useState(false);

  const handleCopilotCardAction = (actionType, payload) => {
    if (actionType === "advance_stage") {
      setInputMessage(`Advance job card ${payload.jobCardId} to the next stage`);
    } else if (actionType === "reserve_stock") {
      setInputMessage(`Reserve 500 meters of item ${payload.itemCode} for our next job`);
    } else if (actionType === "view_details") {
      window.open(`/job-cards?search=${encodeURIComponent(payload.jobCardId)}`, "_blank");
    }
  };

  // Mobile View Guarantee: When user navigates to Communication, ALWAYS display the Chats list screen on mobile!
  useEffect(() => {
    const isMobile = typeof window !== 'undefined' && window.innerWidth < 768;
    if (isMobile && (activeTab === 'communication' || activeTab === 'workspace')) {
      setActiveGroup(null);
      setMainTab('chat');
    }
  }, [activeTab]);

  useEffect(() => {
    const handleOpenChatList = () => {
      const isMobile = typeof window !== 'undefined' && window.innerWidth < 768;
      if (isMobile) {
        setActiveGroup(null);
        setMainTab('chat');
      }
    };
    window.addEventListener('elite-open-chat-list', handleOpenChatList);
    return () => window.removeEventListener('elite-open-chat-list', handleOpenChatList);
  }, []);

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
      const baseTitle = 'Elite Edition ERP';
      if (totalChatUnreadCount > 0) {
        document.title = `(${totalChatUnreadCount}) ${baseTitle}`;
      } else {
        document.title = baseTitle;
      }
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
  const [attachmentViewer, setAttachmentViewer] = useState(null);
  const [viewerZoom, setViewerZoom] = useState(1);
  const [viewerRotation, setViewerRotation] = useState(0);

  const setZoomImg = useCallback((val) => {
    setViewerZoom(1);
    setViewerRotation(0);
    if (!val) {
      setAttachmentViewer(null);
      return;
    }
    if (typeof val === 'string') {
      const fileName = val.split('/').pop().split('?')[0] || 'Image';
      setAttachmentViewer({ url: val, fileName, fileType: 'image' });
    } else {
      setAttachmentViewer(val);
    }
  }, []);
  const [showInRoomSearch, setShowInRoomSearch] = useState(false);
  const [inRoomQuery, setInRoomQuery] = useState('');
  const [showPinnedOnly, setShowPinnedOnly] = useState(false);
  const [chatSoundMuted, setChatSoundMuted] = useState(() => typeof localStorage !== 'undefined' ? localStorage.getItem('elite_chat_sound_muted') === 'true' : false);
  const [playingAudioId, setPlayingAudioId] = useState(null);
  const [playbackSpeed, setPlaybackSpeed] = useState(1);
  const [audioProgress, setAudioProgress] = useState(0);
  const [audioCurrentTime, setAudioCurrentTime] = useState(0);
  const [isAudioPlaying, setIsAudioPlaying] = useState(false);
  const [onlineUserIds, setOnlineUserIds] = useState(new Set());
  const [typingUsers, setTypingUsers] = useState([]);
  const [isChatDragging, setIsChatDragging] = useState(false);
  const [isSocketConnected, setIsSocketConnected] = useState(() => {
    try {
      return socketManager.getStatus() === 'connected';
    } catch (e) {
      return true;
    }
  });

  useEffect(() => {
    const unsub = socketManager.onStatusChange((status) => {
      setIsSocketConnected(status === 'connected');
    });
    setIsSocketConnected(socketManager.getStatus() === 'connected');
    return () => unsub();
  }, []);

  const [editingMessage, setEditingMessage] = useState(null);
  const [deleteTargetMsg, setDeleteTargetMsg] = useState(null);
  const deleteTargetMsgId = deleteTargetMsg?.id || null;
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [msgMenuUpward, setMsgMenuUpward] = useState({});

  useEffect(() => {
    const q = searchQuery.trim();
    if (q.length < 2) {
      setMessageSearchResults([]);
      setIsSearchingMessages(false);
      return;
    }

    // Instant local matches from loaded active room messages
    const lowerQ = q.toLowerCase();
    const localMatches = (messages || []).filter((m) => {
      if (m.isDeleted) return false;
      const textMatch = (m.content || '').toLowerCase().includes(lowerQ);
      const fileMatch = m.attachment && (
        (m.attachment.fileName || '').toLowerCase().includes(lowerQ) ||
        (m.attachment.originalName || '').toLowerCase().includes(lowerQ) ||
        (m.attachment.name || '').toLowerCase().includes(lowerQ)
      );
      return textMatch || fileMatch;
    }).map((m) => ({
      ...m,
      roomId: m.roomId || activeGroup
    }));

    if (localMatches.length > 0) {
      setMessageSearchResults(localMatches);
    }

    const timer = setTimeout(async () => {
      try {
        setIsSearchingMessages(true);
        const res = await api.searchCommunicationMessages(q, 30);
        let serverMatches = [];
        if (res && res.success && Array.isArray(res.results)) {
          serverMatches = res.results;
        } else if (res && res.success && Array.isArray(res.data)) {
          serverMatches = res.data;
        }

        // Merge local and server matches, deduplicating by _id
        const isSuperAdmin = currentUser?.role === 'admin' || currentUser?.role === 'superadmin' || currentUser?.role === 'super_admin' || currentUser?.isAdmin;
        const combinedMap = new Map();
        localMatches.forEach((m) => combinedMap.set(String(m._id), m));
        serverMatches.forEach((m) => {
          const rawRoomId = typeof m.roomId === 'object' ? (m.roomId?._id || m.roomId?.id) : (m.roomId || m.conversationId);
          const hasRoomAccess = isSuperAdmin || (groups || []).some((g) => String(g._id) === String(rawRoomId));
          if (hasRoomAccess) {
            combinedMap.set(String(m._id), m);
          }
        });
        setMessageSearchResults(Array.from(combinedMap.values()));
      } catch (err) {
        console.warn('Message search error:', err);
        if (localMatches.length > 0) {
          setMessageSearchResults(localMatches);
        } else {
          setMessageSearchResults([]);
        }
      } finally {
        setIsSearchingMessages(false);
      }
    }, 250);
    return () => clearTimeout(timer);
  }, [searchQuery, messages, activeGroup, groups, currentUser]);

  const audioElementRef = useRef(null);
  const typingTimeoutRef = useRef(null);
  const isTypingRef = useRef(false);
  const chatDragCounterRef = useRef(0);
  const touchStartXRef = useRef(null);

  const [activeMsgMenuId, setActiveMsgMenuId] = useState(null);
  const msgHoldTimerRef = useRef(null);

  const handleStartMsgHold = (msgId) => {
    if (msgHoldTimerRef.current) {
      clearTimeout(msgHoldTimerRef.current);
    }
    // "click 3 sec after that show this reaction" -> user requested 2.8 - 3s long press
    msgHoldTimerRef.current = setTimeout(() => {
      setActiveMsgMenuId((prev) => (prev === msgId ? null : msgId));
      if (typeof navigator !== 'undefined' && navigator.vibrate) {
        try { navigator.vibrate(60); } catch (e) {}
      }
    }, 2800);
  };

  const handleCancelMsgHold = () => {
    if (msgHoldTimerRef.current) {
      clearTimeout(msgHoldTimerRef.current);
      msgHoldTimerRef.current = null;
    }
  };

  const handleOpenMsgMenu = (e, msgId) => {
    handleCancelMsgHold();
    if (e) {
      if (typeof e.stopPropagation === 'function') e.stopPropagation();
      if (typeof e.preventDefault === 'function') e.preventDefault();
    }
    if (activeMsgMenuId === msgId) {
      setActiveMsgMenuId(null);
      return;
    }
    let upward = false;
    if (e && e.currentTarget && typeof e.currentTarget.getBoundingClientRect === 'function') {
      const rect = e.currentTarget.getBoundingClientRect();
      const spaceBelow = window.innerHeight - rect.bottom;
      upward = spaceBelow < 290;
    }
    setMsgMenuUpward((prev) => ({ ...prev, [msgId]: upward }));
    setActiveMsgMenuId(msgId);
  };
  const [isMobileScreen, setIsMobileScreen] = useState(() => typeof window !== 'undefined' && window.innerWidth < 768);
  const [viewportHeight, setViewportHeight] = useState(null);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    let rAFId = null;
    let lastHeight = null;

    const handleResize = () => {
      if (rAFId) cancelAnimationFrame(rAFId);
      rAFId = requestAnimationFrame(() => {
        const isMob = window.innerWidth < 768;
        setIsMobileScreen(isMob);
        if (isMob) {
          const vv = window.visualViewport;
          const newH = vv ? Math.round(vv.height) : window.innerHeight;
          // Only trigger state re-render if height change is substantial (> 30px, e.g. software keyboard)
          if (lastHeight === null || Math.abs(newH - lastHeight) > 30) {
            lastHeight = newH;
            setViewportHeight(newH);
          }
        } else {
          if (lastHeight !== null) {
            lastHeight = null;
            setViewportHeight(null);
          }
        }
      });
    };

    handleResize();
    window.addEventListener('resize', handleResize);
    if (window.visualViewport) {
      window.visualViewport.addEventListener('resize', handleResize);
      // NOTE: Do NOT attach to visualViewport 'scroll' to prevent rapid re-render loops while scrolling on mobile
    }
    return () => {
      if (rAFId) cancelAnimationFrame(rAFId);
      window.removeEventListener('resize', handleResize);
      if (window.visualViewport) {
        window.visualViewport.removeEventListener('resize', handleResize);
      }
    };
  }, []);

  useEffect(() => {
    return () => {
      if (audioElementRef.current) {
        audioElementRef.current.pause();
        audioElementRef.current = null;
      }
      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current);
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
  const peerConnectionRef = useRef(null);
  const remoteAudioRef = useRef(null);
  const remoteVideoRef = useRef(null);
  const isNearBottomRef = useRef(true);
  const activeCallRef = useRef(null);
  const iceCandidatesQueue = useRef([]);
  const callTimeoutRef = useRef(null);

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
  const [isSendingMessage, setIsSendingMessage] = useState(false);
  const loadingOlderRef = useRef(false);
  const hasMoreMessagesRef = useRef(true);
  const chatScrollRef = useRef(null);
  const fetchAbortControllerRef = useRef(null);
  const [showScrollBottom, setShowScrollBottom] = useState(false);
  const [unreadBelowCount, setUnreadBelowCount] = useState(0);

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

  // Group Chat @mention State
  const [mentionQuery, setMentionQuery] = useState(null);
  const [mentionIndex, setMentionIndex] = useState(0);
  const [mentionedUserIds, setMentionedUserIds] = useState([]);
  const chatTextareaRef = useRef(null);

  const getTomorrowLocalDate = () => {
    const d = new Date();
    d.setDate(d.getDate() + 1);
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  useEffect(() => {
    api.getUsers({ limit: 100 })
      .then(res => {
        const uList = Array.isArray(res) ? res : (res?.data || res?.results || []);
        if (Array.isArray(uList)) setStaffUsers(uList);
      })
      .catch(err => console.warn('Could not load staff users for chat task creation:', err));
  }, []);

  // Universal File Upload Hook for R2
  const { uploadFile: uploadChatFileToR2, progress: uploadChatProgress } = useFileUpload();

  // Escape Key Modal Dismissal
  useEffect(() => {
    const handleEscapeDismiss = (e) => {
      if (e.key === 'Escape') {
        if (showEmojiPicker) {
          e.preventDefault();
          setShowEmojiPicker(false);
          return;
        }
        if (mentionQuery !== null) {
          e.preventDefault();
          setMentionQuery(null);
          return;
        }
        if (activeMsgMenuId !== null) {
          e.preventDefault();
          setActiveMsgMenuId(null);
          return;
        }
        if (deleteTargetMsg !== null) {
          e.preventDefault();
          setDeleteTargetMsg(null);
          return;
        }
        if (showMobileActionMenu) setShowMobileActionMenu(false);
        else if (showMobileHeaderMenu) setShowMobileHeaderMenu(false);
        else if (showDesktopHeaderMenu) setShowDesktopHeaderMenu(false);
        else if (showNewDmModal) setShowNewDmModal(false);
        else if (showCreateGroupModal) setShowCreateGroupModal(false);
        else if (showMembersModal) setShowMembersModal(false);
        else if (showShareModal) setShowShareModal(false);
        else if (showGalleryModal) setShowGalleryModal(false);
        else if (showPollModal) setShowPollModal(false);
        else if (showForwardModal) setShowForwardModal(false);
        else if (showClearAllModal) setShowClearAllModal(false);
        else if (showChatTaskModal) setShowChatTaskModal(false);
        else if (showDialpad) setShowDialpad(false);
        else if (attachmentViewer) setAttachmentViewer(null);
      }
    };
    window.addEventListener('keydown', handleEscapeDismiss);
    return () => window.removeEventListener('keydown', handleEscapeDismiss);
  }, [
    showEmojiPicker, mentionQuery, activeMsgMenuId, deleteTargetMsg,
    showMobileActionMenu, showMobileHeaderMenu, showDesktopHeaderMenu,
    showNewDmModal, showCreateGroupModal, showMembersModal, showShareModal,
    showGalleryModal, showPollModal, showForwardModal, showClearAllModal,
    showChatTaskModal, showDialpad, attachmentViewer
  ]);

  // ─── Real-Time Voice & Video Calling Handlers (WebRTC) ───
  useEffect(() => {
    activeCallRef.current = activeCall;
  }, [activeCall]);

  const formatDuration = (secs) => {
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  };

  const setupAudioVisualizer = (stream) => {
    if (audioIntervalRef.current) {
      clearInterval(audioIntervalRef.current);
      audioIntervalRef.current = null;
    }
    if (audioContextRef.current) {
      try { audioContextRef.current.close(); } catch (e) {}
      audioContextRef.current = null;
    }
    try {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (AudioCtx && stream) {
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
      console.warn('Audio visualizer setup warning:', visErr);
    }
  };

  // ── Web Audio Ringtone & Ringback Synthesizer (Zero asset dependencies) ──
  const ringtoneIntervalRef = useRef(null);
  const ringtoneAudioCtxRef = useRef(null);

  const playTone = (freq1, freq2, durationMs) => {
    try {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (!AudioCtx) return;
      if (!ringtoneAudioCtxRef.current || ringtoneAudioCtxRef.current.state === 'closed') {
        ringtoneAudioCtxRef.current = new AudioCtx();
      }
      if (ringtoneAudioCtxRef.current.state === 'suspended') {
        ringtoneAudioCtxRef.current.resume().catch(() => {});
      }
      const ctx = ringtoneAudioCtxRef.current;
      const osc1 = ctx.createOscillator();
      const osc2 = ctx.createOscillator();
      const gainNode = ctx.createGain();

      osc1.type = 'sine';
      osc2.type = 'sine';
      osc1.frequency.setValueAtTime(freq1, ctx.currentTime);
      osc2.frequency.setValueAtTime(freq2, ctx.currentTime);

      gainNode.gain.setValueAtTime(0.22, ctx.currentTime);
      gainNode.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + durationMs / 1000);

      osc1.connect(gainNode);
      osc2.connect(gainNode);
      gainNode.connect(ctx.destination);

      osc1.start();
      osc2.start();
      osc1.stop(ctx.currentTime + durationMs / 1000);
      osc2.stop(ctx.currentTime + durationMs / 1000);
    } catch (e) {
      console.warn('Audio ringtone error:', e);
    }
  };

  const startIncomingRingtone = () => {
    stopCallRingtones();
    playTone(587.33, 880, 450);
    setTimeout(() => playTone(659.25, 987.77, 650), 500);
    if (typeof navigator !== 'undefined' && navigator.vibrate) {
      try { navigator.vibrate([350, 150, 350, 150, 600]); } catch (e) {}
    }
    ringtoneIntervalRef.current = setInterval(() => {
      playTone(587.33, 880, 450);
      setTimeout(() => playTone(659.25, 987.77, 650), 500);
      if (typeof navigator !== 'undefined' && navigator.vibrate) {
        try { navigator.vibrate([350, 150, 350, 150, 600]); } catch (e) {}
      }
    }, 2400);
  };

  const startOutgoingRingback = () => {
    stopCallRingtones();
    playTone(440, 480, 1200);
    ringtoneIntervalRef.current = setInterval(() => {
      playTone(440, 480, 1200);
    }, 3500);
  };

  const stopCallRingtones = () => {
    if (ringtoneIntervalRef.current) {
      clearInterval(ringtoneIntervalRef.current);
      ringtoneIntervalRef.current = null;
    }
    if (typeof navigator !== 'undefined' && navigator.vibrate) {
      try { navigator.vibrate(0); } catch (e) {}
    }
  };

  const triggerCallPushNotification = (data) => {
    // 1. Browser OS Push Notification
    try {
      if ('Notification' in window) {
        if (Notification.permission === 'granted') {
          const notif = new Notification(`📞 Incoming ${data.callType === 'video' ? 'Video' : 'Voice'} Call`, {
            body: `${data.callerName || 'Team Member'} is calling you on Elite Edition... Click to answer!`,
            icon: '/Logo.png',
            badge: '/Logo.png',
            tag: `call-${data.roomId}`,
            requireInteraction: true,
            vibrate: [300, 150, 300, 150, 400]
          });
          notif.onclick = () => {
            window.focus();
            notif.close();
          };
        } else if (Notification.permission === 'default') {
          Notification.requestPermission();
        }
      }
    } catch (e) {
      console.warn('Call Notification error:', e);
    }

    // 2. ServiceWorker Notification
    try {
      if ('serviceWorker' in navigator && navigator.serviceWorker.ready) {
        navigator.serviceWorker.ready.then((reg) => {
          reg.showNotification(`📞 Incoming ${data.callType === 'video' ? 'Video' : 'Voice'} Call`, {
            body: `${data.callerName || 'Team Member'} is calling you... Click to answer!`,
            icon: '/Logo.png',
            badge: '/Logo.png',
            tag: `call-${data.roomId}`,
            requireInteraction: true,
            vibrate: [300, 150, 300, 150, 400]
          }).catch(() => {});
        });
      }
    } catch (e) {}

    // 3. In-App Toast
    try {
      window.dispatchEvent(new CustomEvent('elite-push-notification', {
        detail: {
          title: `📞 Incoming ${data.callType === 'video' ? 'Video' : 'Voice'} Call`,
          message: `${data.callerName || 'Team Member'} is calling you. Click to Answer!`,
          type: 'warning',
          timestamp: Date.now()
        }
      }));
    } catch (e) {}
  };

  const initLocalMedia = async (type) => {
    if (localStreamRef.current) {
      try { localStreamRef.current.getTracks().forEach((t) => t.stop()); } catch (e) {}
      localStreamRef.current = null;
    }

    const constraints = type === 'video'
      ? { audio: true, video: { width: { ideal: 1280 }, height: { ideal: 720 } } }
      : { audio: true, video: false };

    let stream = null;
    try {
      if (typeof navigator !== 'undefined' && navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
        stream = await navigator.mediaDevices.getUserMedia(constraints);
      }
    } catch (err) {
      console.warn('Initial getUserMedia capture failed, trying audio fallback:', err);
      try {
        if (typeof navigator !== 'undefined' && navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
          stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
        }
      } catch (err2) {
        console.error('Microphone capture failed:', err2);
      }
    }

    if (stream) {
      localStreamRef.current = stream;
      if (localVideoRef.current && type === 'video') {
        localVideoRef.current.srcObject = stream;
      }
      setupAudioVisualizer(stream);
    }
    return stream;
  };

  const createPeerConnection = (roomId) => {
    if (peerConnectionRef.current) {
      try { peerConnectionRef.current.close(); } catch (e) {}
      peerConnectionRef.current = null;
    }

    // Reset ICE candidates queue for fresh call handshake
    iceCandidatesQueue.current = [];

    const pc = new RTCPeerConnection({
      iceServers: ICE_SERVERS,
      iceCandidatePoolSize: 10
    });
    peerConnectionRef.current = pc;

    pc.onicecandidate = (event) => {
      if (event.candidate && socket && roomId) {
        const otherId = activeCallRef.current?.recipientId || activeCallRef.current?.callerId;
        socket.emit('webrtc-ice-candidate', {
          roomId,
          candidate: event.candidate,
          targetUserId: otherId,
          caller: activeCallRef.current?.callerId,
          recipientId: activeCallRef.current?.recipientId
        });
      }
    };

    pc.ontrack = (event) => {
      console.log('WebRTC ontrack received:', event.track.kind);
      const remoteStream = event.streams && event.streams[0] ? event.streams[0] : new MediaStream([event.track]);
      if (remoteAudioRef.current) {
        remoteAudioRef.current.srcObject = remoteStream;
        remoteAudioRef.current.play().catch((e) => console.warn('Remote audio autoplay:', e));
      }
      if (remoteVideoRef.current) {
        remoteVideoRef.current.srcObject = remoteStream;
        remoteVideoRef.current.play().catch((e) => console.warn('Remote video autoplay:', e));
      }
    };

    pc.onconnectionstatechange = () => {
      console.log('WebRTC connectionState:', pc.connectionState);
      if (pc.connectionState === 'connected') {
        if (callTimeoutRef.current) {
          clearTimeout(callTimeoutRef.current);
          callTimeoutRef.current = null;
        }
        stopCallRingtones();
        setActiveCall((prev) => (prev ? { ...prev, status: 'connected', error: null } : null));
      } else if (pc.connectionState === 'failed') {
        if (pc.restartIce) {
          pc.restartIce();
        }
      }
    };

    pc.oniceconnectionstatechange = () => {
      console.log('WebRTC iceConnectionState:', pc.iceConnectionState);
      if (pc.iceConnectionState === 'connected' || pc.iceConnectionState === 'completed') {
        if (callTimeoutRef.current) {
          clearTimeout(callTimeoutRef.current);
          callTimeoutRef.current = null;
        }
        stopCallRingtones();
        setActiveCall((prev) => (prev ? { ...prev, status: 'connected', error: null } : null));
      }
    };

    return pc;
  };

  const startCall = async (type = 'voice') => {
    if (!activeGroup) return;
    const recipient = activeGroup.displayName || activeGroup.name || 'Team Member';
    const recipientAvatar = activeGroup.avatar || null;
    const roomId = activeGroup._id;

    // Direct Colleague ID for 1-on-1 calls
    let recipientId = null;
    if (activeGroup.type === 'direct' && Array.isArray(activeGroup.members)) {
      const myId = String(currentUser?._id || currentUser?.id || '');
      const other = activeGroup.members.find((m) => {
        const mId = String(typeof m === 'object' ? (m._id || m.id) : m);
        return mId !== myId;
      });
      if (other) recipientId = typeof other === 'object' ? (other._id || other.id) : other;
    }

    const myId = currentUser?._id || currentUser?.id;

    setActiveCall({
      type,
      recipientName: recipient,
      recipientAvatar,
      status: 'calling',
      isMuted: false,
      isVideoOff: false,
      isSpeakerOn: true,
      isScreenSharing: false,
      error: null,
      roomId,
      recipientId,
      callerId: myId
    });
    setCallDuration(0);
    setShowDialpad(false);
    setDialpadDigits('');

    // Play outgoing ringback tone
    startOutgoingRingback();

    // 32-second auto-timeout if user does not answer / network unreachable
    if (callTimeoutRef.current) clearTimeout(callTimeoutRef.current);
    callTimeoutRef.current = setTimeout(() => {
      if (activeCallRef.current && activeCallRef.current.status === 'calling') {
        stopCallRingtones();
        setActiveCall((prev) => (prev ? {
          ...prev,
          status: 'ended',
          error: 'User did not answer (Unavailable)'
        } : null));
        if (socket && roomId) {
          socket.emit('call-timeout', {
            roomId,
            caller: myId,
            recipientId
          });
          socket.emit('send-message', {
            roomId,
            senderId: myId,
            content: `Missed ${type === 'video' ? 'video' : 'voice'} call`,
            type: 'call-log',
            activityMeta: {
              callType: type,
              status: 'missed',
              timestamp: new Date().toISOString()
            }
          });
        }
        setTimeout(() => endCall(true), 2500);
      }
    }, 32000);

    const stream = await initLocalMedia(type);
    if (!stream) {
      stopCallRingtones();
      if (callTimeoutRef.current) clearTimeout(callTimeoutRef.current);
      setActiveCall((prev) => (prev ? {
        ...prev,
        status: 'ended',
        error: 'Microphone/Camera access denied. Please allow permission in browser settings.'
      } : null));
      setTimeout(() => endCall(false), 3000);
      return;
    }

    const pc = createPeerConnection(roomId);
    if (stream && pc) {
      stream.getTracks().forEach((track) => pc.addTrack(track, stream));
    }

    if (socket && roomId) {
      socket.emit('call-user', {
        roomId,
        recipientId,
        recipientName: recipient,
        callType: type,
        caller: myId,
        callerName: currentUser?.name || currentUser?.username || 'Team Member',
        callerAvatar: currentUser?.avatar || null
      });
    }
  };

  const endCall = (shouldEmit = true) => {
    stopCallRingtones();
    if (callTimeoutRef.current) {
      clearTimeout(callTimeoutRef.current);
      callTimeoutRef.current = null;
    }
    iceCandidatesQueue.current = [];

    const currentRoomId = activeCallRef.current?.roomId || activeGroup?._id;
    if (shouldEmit && socket && currentRoomId) {
      socket.emit('end-call', {
        roomId: currentRoomId,
        from: currentUser?._id || currentUser?.id,
        recipientId: activeCallRef.current?.recipientId,
        caller: activeCallRef.current?.callerId
      });
    }

    if (peerConnectionRef.current) {
      try {
        peerConnectionRef.current.close();
      } catch (e) {}
      peerConnectionRef.current = null;
    }

    if (remoteAudioRef.current) {
      remoteAudioRef.current.srcObject = null;
    }
    if (remoteVideoRef.current) {
      remoteVideoRef.current.srcObject = null;
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
    }, 1200);
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

  const answerIncomingCall = async () => {
    if (!incomingCall) return;
    stopCallRingtones();
    const type = incomingCall.callType || 'voice';
    const roomId = incomingCall.roomId;
    const callerName = incomingCall.callerName || 'Team Member';
    const callerId = incomingCall.caller || null;
    const myId = currentUser?._id || currentUser?.id;
    setIncomingCall(null);

    // Make sure callee is actively joined to the socket room
    if (socket && roomId) {
      socket.emit('join-room', roomId);
    }

    setActiveCall({
      type,
      recipientName: callerName,
      recipientAvatar: null,
      status: 'connected',
      isMuted: false,
      isVideoOff: false,
      isSpeakerOn: true,
      isScreenSharing: false,
      error: null,
      roomId,
      callerId,
      recipientId: myId
    });
    setCallDuration(0);
    setShowDialpad(false);
    setDialpadDigits('');

    const stream = await initLocalMedia(type);
    if (!stream) {
      stopCallRingtones();
      setActiveCall((prev) => (prev ? {
        ...prev,
        status: 'ended',
        error: 'Microphone/Camera access denied. Please allow permission in browser settings.'
      } : null));
      setTimeout(() => endCall(false), 3000);
      return;
    }

    const pc = createPeerConnection(roomId);
    if (stream && pc) {
      stream.getTracks().forEach((track) => pc.addTrack(track, stream));
    }

    if (socket && roomId) {
      socket.emit('accept-call', {
        roomId,
        caller: callerId,
        accepter: myId
      });
    }
  };

  const declineIncomingCall = () => {
    if (!incomingCall) return;
    stopCallRingtones();
    if (socket && incomingCall.roomId) {
      socket.emit('decline-call', {
        roomId: incomingCall.roomId,
        caller: incomingCall.caller || null,
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
    const tomorrowStr = getTomorrowLocalDate();

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
    const tomorrowStr = getTomorrowLocalDate();

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
            const clientMsgId = 'client_' + Date.now() + '_' + Math.random().toString(36).slice(2, 9);
            await api.sendCommunicationMessage(activeGroup._id, {
              roomId: activeGroup._id,
              senderId: myId,
              clientMsgId,
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

  const handleDeleteMessage = (msgOrId) => {
    if (!msgOrId) return;
    if (typeof msgOrId === 'object') {
      const text = msgOrId.content || (msgOrId.attachment?.fileName ? `Attachment: ${msgOrId.attachment.fileName}` : 'Message');
      setDeleteTargetMsg({
        id: String(msgOrId._id || msgOrId.id),
        text: text,
        senderName: msgOrId.senderName || msgOrId.senderId?.name || ''
      });
    } else {
      const found = messages.find((m) => String(m._id) === String(msgOrId));
      const text = found?.content || (found?.attachment?.fileName ? `Attachment: ${found.attachment.fileName}` : 'Message');
      setDeleteTargetMsg({
        id: String(msgOrId),
        text: text,
        senderName: found?.senderName || found?.senderId?.name || ''
      });
    }
  };

  const confirmDeleteMessage = async (messageId) => {
    if (!messageId) return;
    if (String(messageId).startsWith('temp_')) {
      setMessages((prev) => prev.filter((m) => String(m._id) !== String(messageId) && m.clientMsgId !== messageId));
      setDeleteTargetMsg(null);
      return;
    }
    try {
      const res = await api.deleteCommunicationMessage(messageId);
      if (res.success) {
        setMessages((prev) =>
          prev.map((m) =>
            String(m._id) === String(messageId)
              ? { ...m, content: 'This message was deleted', isDeleted: true, attachment: null }
              : m
          )
        );
        setGroups((prevGroups) =>
          prevGroups.map((g) => {
            if (String(g._id) === String(activeGroup?._id)) {
              if (g.lastMessage && String(g.lastMessage._id || g.lastMessage) === String(messageId)) {
                return {
                  ...g,
                  lastMessage: {
                    ...(typeof g.lastMessage === 'object' ? g.lastMessage : {}),
                    content: 'This message was deleted',
                    isDeleted: true
                  }
                };
              }
            }
            return g;
          })
        );
        if (socket) {
          socket.emit('delete-message', { messageId, roomId: activeGroup?._id });
        }
      } else {
        alert(res.message || 'Failed to delete message');
      }
    } catch (err) {
      alert(err.message || 'Failed to delete message');
    } finally {
      setDeleteTargetMsg(null);
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

  // Keep in-memory cache synchronized with current messages without cross-room pollution
  useEffect(() => {
    if (activeGroup?._id && Array.isArray(messages) && messages.length > 0) {
      const firstWithRoom = messages.find((m) => m && m.roomId);
      if (firstWithRoom && String(firstWithRoom.roomId) === String(activeGroup._id)) {
        messagesCacheRef.current[activeGroup._id] = messages;
      }
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
      setIsSocketConnected(true);
      if (uId) {
        socket.emit('register-user', uId);
      }
      if (activeGroupIdRef.current) {
        socket.emit('join-room', activeGroupIdRef.current);
      }
    };

    const handleDisconnect = () => {
      setIsSocketConnected(false);
    };

    const handleConnectError = () => {
      setIsSocketConnected(false);
    };

    if (socket.connected) {
      handleConnect();
    } else {
      setIsSocketConnected(false);
    }

    const handleReceiveMessage = (msg) => {
      const currentActiveId = activeGroupIdRef.current;
      if (currentActiveId && String(msg.roomId) === String(currentActiveId)) {
        if (!isNearBottomRef.current) {
          setShowScrollBottom(true);
          setUnreadBelowCount((c) => c + 1);
        }
        setMessages((prev) => {
          // Filter out matching optimistic placeholder if real message arrives
          const filtered = prev.filter((m) => !(m.isOptimistic && ((m.clientMsgId && msg.clientMsgId && m.clientMsgId === msg.clientMsgId) || m.content === msg.content || String(m._id) === String(msg._id))));
          return mergeMessages(filtered, [{ ...msg, isOptimistic: false }]);
        });
        if (socket && uId) {
          socket.emit('read-room-messages', { roomId: currentActiveId, userId: uId });
        }
      }

      if (socket && uId && msg && msg.roomId) {
        socket.emit('sync-delivered', { roomId: msg.roomId, userId: uId });
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
        setGroups((prevGroups) =>
          prevGroups.map((g) => {
            if (!data.roomId || String(g._id) === String(data.roomId)) {
              if (g.lastMessage && String(g.lastMessage._id || g.lastMessage) === String(data.messageId)) {
                return {
                  ...g,
                  lastMessage: {
                    ...(typeof g.lastMessage === 'object' ? g.lastMessage : {}),
                    content: 'This message was deleted',
                    isDeleted: true
                  }
                };
              }
            }
            return g;
          })
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

    const handleMessagesDelivered = (data) => {
      if (data && data.roomId) {
        const currentActiveId = activeGroupIdRef.current;
        if (currentActiveId && String(data.roomId) === String(currentActiveId)) {
          setMessages((prev) =>
            prev.map((m) => {
              const myId = String(currentUser?._id || currentUser?.id || '');
              const senderId = String(typeof m.senderId === 'object' ? (m.senderId?._id || m.senderId?.id) : m.senderId);
              if (senderId === myId) {
                const currentDelivered = Array.isArray(m.deliveredTo) ? m.deliveredTo.map(String) : [];
                if (!currentDelivered.includes(String(data.userId))) {
                  return {
                    ...m,
                    deliveredTo: [...(m.deliveredTo || []), data.userId],
                    status: m.status === 'read' ? 'read' : 'delivered'
                  };
                }
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
        const myId = String(currentUser?._id || currentUser?.id || '');
        if (data.caller && String(data.caller) === myId) return; // Don't ring self
        setIncomingCall(data);
        startIncomingRingtone();
        triggerCallPushNotification(data);
      }
    };

    const handleCallAccepted = async (data) => {
      if (callTimeoutRef.current) {
        clearTimeout(callTimeoutRef.current);
        callTimeoutRef.current = null;
      }
      stopCallRingtones();
      setActiveCall((prev) => (prev ? { ...prev, status: 'connected' } : null));
      const pc = peerConnectionRef.current;
      const rId = activeCallRef.current?.roomId || activeGroupIdRef.current;
      const myId = currentUser?._id || currentUser?.id;
      const otherId = data?.accepter || activeCallRef.current?.recipientId;

      if (pc && rId) {
        try {
          const offer = await pc.createOffer();
          await pc.setLocalDescription(offer);
          if (socket) {
            socket.emit('webrtc-offer', {
              roomId: rId,
              offer,
              caller: myId,
              recipientId: otherId
            });
          }
        } catch (err) {
          console.error('Failed to create WebRTC offer:', err);
        }
      }
    };

    const handleWebRtcOffer = async (data) => {
      if (!data || !data.offer) return;
      const pc = peerConnectionRef.current;
      const myId = currentUser?._id || currentUser?.id;
      if (pc) {
        try {
          await pc.setRemoteDescription(new RTCSessionDescription(data.offer));
          // Drain buffered candidates
          while (iceCandidatesQueue.current.length > 0) {
            const cand = iceCandidatesQueue.current.shift();
            try { await pc.addIceCandidate(cand); } catch (e) {}
          }
          const answer = await pc.createAnswer();
          await pc.setLocalDescription(answer);
          if (socket && data.roomId) {
            socket.emit('webrtc-answer', {
              roomId: data.roomId,
              answer,
              caller: data.caller,
              recipientId: myId
            });
          }
        } catch (err) {
          console.error('Failed to handle WebRTC offer:', err);
        }
      }
    };

    const handleWebRtcAnswer = async (data) => {
      if (!data || !data.answer) return;
      const pc = peerConnectionRef.current;
      if (pc) {
        try {
          await pc.setRemoteDescription(new RTCSessionDescription(data.answer));
          // Drain buffered candidates
          while (iceCandidatesQueue.current.length > 0) {
            const cand = iceCandidatesQueue.current.shift();
            try { await pc.addIceCandidate(cand); } catch (e) {}
          }
        } catch (err) {
          console.error('Failed to handle WebRTC answer:', err);
        }
      }
    };

    const handleWebRtcIceCandidate = async (data) => {
      if (!data || !data.candidate) return;
      const pc = peerConnectionRef.current;
      if (pc) {
        const candidate = new RTCIceCandidate(data.candidate);
        if (pc.remoteDescription && pc.remoteDescription.type) {
          try {
            await pc.addIceCandidate(candidate);
          } catch (err) {
            console.warn('Failed to add ICE candidate:', err);
          }
        } else {
          iceCandidatesQueue.current.push(candidate);
        }
      }
    };

    const handleCallFailed = (data) => {
      if (callTimeoutRef.current) {
        clearTimeout(callTimeoutRef.current);
        callTimeoutRef.current = null;
      }
      stopCallRingtones();
      const callSnapshot = activeCallRef.current;
      if (callSnapshot && callSnapshot.roomId && socket) {
        socket.emit('send-message', {
          roomId: callSnapshot.roomId,
          senderId: currentUser?._id || currentUser?.id,
          content: `Missed ${callSnapshot.type === 'video' ? 'video' : 'voice'} call (User unavailable)`,
          type: 'call-log',
          activityMeta: {
            callType: callSnapshot.type || 'voice',
            status: 'missed',
            timestamp: new Date().toISOString()
          }
        });
      }
      setActiveCall((prev) => (prev ? {
        ...prev,
        status: 'ended',
        error: data?.message || 'User is currently offline or unreachable'
      } : null));
      setTimeout(() => endCall(false), 3000);
    };

    const handleCallDeclined = () => {
      stopCallRingtones();
      setActiveCall((prev) => (prev ? { ...prev, status: 'ended', error: 'Call declined by user' } : null));
      setTimeout(() => setActiveCall(null), 1800);
    };

    const handleCallEnded = () => {
      stopCallRingtones();
      endCall(false);
    };

    const handlePresenceSync = (onlineIds) => {
      if (Array.isArray(onlineIds)) {
        setOnlineUserIds(new Set(onlineIds.map(String)));
      }
    };

    const handleUserTyping = (data) => {
      if (!data) return;
      const { roomId, username, isTyping } = data;
      if (activeGroupRef.current && String(activeGroupRef.current._id) === String(roomId)) {
        setTypingUsers((prev) => {
          const uName = username || 'Someone';
          if (isTyping) {
            if (!prev.includes(uName)) return [...prev, uName];
            return prev;
          } else {
            return prev.filter((u) => u !== uName);
          }
        });
      }
    };

    socket.on('connect', handleConnect);
    socket.on('disconnect', handleDisconnect);
    socket.on('connect_error', handleConnectError);
    socket.on('receive-message', handleReceiveMessage);
    socket.on('message-acknowledged', handleAck);
    socket.on('activity-notification', handleActivity);
    socket.on('message-reaction-updated', handleReaction);
    socket.on('message-edited', handleEdited);
    socket.on('message-deleted', handleDeleted);
    socket.on('message-pin-updated', handlePinUpdated);
    socket.on('room-messages-read', handleRoomMessagesRead);
    socket.on('messages-delivered', handleMessagesDelivered);
    socket.on('poll-updated', handlePollUpdated);
    socket.on('communication-data-cleared', handleDataCleared);
    socket.on('presence-sync', handlePresenceSync);
    socket.on('user-typing', handleUserTyping);
    socket.on('incoming-call', handleIncomingCall);
    socket.on('call-accepted', handleCallAccepted);
    socket.on('call-declined', handleCallDeclined);
    socket.on('call-ended', handleCallEnded);
    socket.on('call-failed', handleCallFailed);
    socket.on('webrtc-offer', handleWebRtcOffer);
    socket.on('webrtc-answer', handleWebRtcAnswer);
    socket.on('webrtc-ice-candidate', handleWebRtcIceCandidate);

    return () => {
      socket.off('connect', handleConnect);
      socket.off('disconnect', handleDisconnect);
      socket.off('connect_error', handleConnectError);
      socket.off('receive-message', handleReceiveMessage);
      socket.off('message-acknowledged', handleAck);
      socket.off('activity-notification', handleActivity);
      socket.off('message-reaction-updated', handleReaction);
      socket.off('message-edited', handleEdited);
      socket.off('message-deleted', handleDeleted);
      socket.off('message-pin-updated', handlePinUpdated);
      socket.off('room-messages-read', handleRoomMessagesRead);
      socket.off('messages-delivered', handleMessagesDelivered);
      socket.off('poll-updated', handlePollUpdated);
      socket.off('communication-data-cleared', handleDataCleared);
      socket.off('presence-sync', handlePresenceSync);
      socket.off('user-typing', handleUserTyping);
      socket.off('incoming-call', handleIncomingCall);
      socket.off('call-accepted', handleCallAccepted);
      socket.off('call-declined', handleCallDeclined);
      socket.off('call-ended', handleCallEnded);
      socket.off('call-failed', handleCallFailed);
      socket.off('webrtc-offer', handleWebRtcOffer);
      socket.off('webrtc-answer', handleWebRtcAnswer);
      socket.off('webrtc-ice-candidate', handleWebRtcIceCandidate);
    };
  }, [socket, currentUser]);

  // Fallback 10-second polling when WebSocket is disconnected/reconnecting so delivery ticks and messages update
  useEffect(() => {
    if (isSocketConnected || !activeGroup?._id) return;
    const fallbackPollInterval = setInterval(() => {
      // S3 FIX: Do not poll if user has scrolled up reading past history (>120px from bottom)
      if (!isNearBottomRef.current) return;
      if (activeGroupIdRef.current) {
        pollLatestGroupMessages(activeGroupIdRef.current, msgFilter);
      }
    }, 10000);
    return () => clearInterval(fallbackPollInterval);
  }, [isSocketConnected, activeGroup?._id, msgFilter]);

  // Handle global answering from outside tabs (e.g. from App.jsx global call banner)
  useEffect(() => {
    const handleGlobalAnswer = (e) => {
      if (e.detail) {
        const callData = e.detail;
        setIncomingCall(callData);
        setTimeout(() => {
          answerIncomingCall();
        }, 150);
      }
    };
    window.addEventListener('elite-answer-call', handleGlobalAnswer);
    return () => window.removeEventListener('elite-answer-call', handleGlobalAnswer);
  }, []);

  // Listen for background sync messages on reconnection
  useEffect(() => {
    const handleSyncMessage = (e) => {
      if (!e.detail) return;
      const raw = e.detail;
      const incomingList = Array.isArray(raw.messages)
        ? raw.messages
        : Array.isArray(raw)
        ? raw
        : raw._id
        ? [raw]
        : [];
      if (incomingList.length === 0) return;

      const currentActiveId = activeGroupIdRef.current;
      const activeRoomMsgs = incomingList.filter(
        (m) => currentActiveId && String(m.roomId) === String(currentActiveId)
      );

      if (activeRoomMsgs.length > 0) {
        setMessages((prev) => mergeMessages(prev, activeRoomMsgs));
      }

      // Also update groups' lastMessage & updatedAt
      setGroups((prevGroups) => {
        const lastMsgByRoom = new Map();
        for (const m of incomingList) {
          if (m.roomId) {
            const rid = String(m.roomId);
            const prevCandidate = lastMsgByRoom.get(rid);
            if (!prevCandidate || new Date(m.createdAt || 0) > new Date(prevCandidate.createdAt || 0)) {
              lastMsgByRoom.set(rid, m);
            }
          }
        }
        if (lastMsgByRoom.size === 0) return prevGroups;

        return prevGroups.map((g) => {
          const latestForGroup = lastMsgByRoom.get(String(g._id));
          if (latestForGroup) {
            return {
              ...g,
              lastMessage: latestForGroup,
              updatedAt: latestForGroup.createdAt || g.updatedAt
            };
          }
          return g;
        });
      });
    };
    window.addEventListener('elite-chat-sync-message', handleSyncMessage);
    return () => window.removeEventListener('elite-chat-sync-message', handleSyncMessage);
  }, []);

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

  const scrollToChatBottom = useCallback((smooth = false) => {
    setShowScrollBottom(false);
    setUnreadBelowCount(0);
    isNearBottomRef.current = true;
    if (chatScrollRef.current) {
      if (smooth) {
        chatScrollRef.current.scrollTo({
          top: chatScrollRef.current.scrollHeight,
          behavior: 'smooth'
        });
      } else {
        chatScrollRef.current.scrollTop = chatScrollRef.current.scrollHeight;
      }
    }
  }, []);

  const handleSelectGroup = (targetGroup) => {
    if (!targetGroup) return;
    setShowScrollBottom(false);
    setUnreadBelowCount(0);
    if (activeGroup?._id && inputMessage) {
      setRoomDrafts((prev) => ({
        ...prev,
        [activeGroup._id]: inputMessage
      }));
    }

    // Abort any ongoing stream history fetch from previous room
    if (fetchAbortControllerRef.current) {
      try { fetchAbortControllerRef.current.abort(); } catch (e) {}
    }
    fetchAbortControllerRef.current = new AbortController();

    // Reset pagination, error, and stream state on room switch
    activeGroupIdRef.current = targetGroup._id;
    setStreamHistoryError(null);
    setPage(1);
    setHasMoreMessages(true);
    hasMoreMessagesRef.current = true;
    setLoadingMoreMessages(false);

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

    // Support Android / mobile browser back gesture/button to return to chat list
    const isMobile = typeof window !== 'undefined' && (window.innerWidth < 768 || isMobileScreen);
    if (isMobile && typeof window !== 'undefined' && window.history?.pushState) {
      window.history.pushState({ eliteChatRoom: targetGroup._id }, '');
    }
  };

  // Mobile Back Button / Gesture support to return to Chats list screen
  useEffect(() => {
    const handlePopState = () => {
      const isMobile = typeof window !== 'undefined' && (window.innerWidth < 768 || isMobileScreen);
      if (isMobile) {
        setActiveGroup(null);
        setShowMobileActionMenu(false);
        setShowMobileHeaderMenu(false);
      }
    };
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, [isMobileScreen]);

  // Auto-scroll to bottom on thread open
  useEffect(() => {
    if (activeGroup?._id) {
      isNearBottomRef.current = true;
      setShowScrollBottom(false);
      setUnreadBelowCount(0);
      if (chatScrollRef.current) {
        chatScrollRef.current.scrollTop = chatScrollRef.current.scrollHeight;
      }
      const t = setTimeout(() => {
        if (chatScrollRef.current) {
          chatScrollRef.current.scrollTop = chatScrollRef.current.scrollHeight;
        }
      }, 60);
      return () => clearTimeout(t);
    }
  }, [activeGroup?._id]);

  // Auto-scroll to chat bottom safely strictly within message container
  useEffect(() => {
    if (isNearBottomRef.current && chatScrollRef.current) {
      chatScrollRef.current.scrollTop = chatScrollRef.current.scrollHeight;
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

          const merged = Array.from(serverMap.values());
          merged.sort((a, b) => {
            if (a.isPinned && !b.isPinned) return -1;
            if (!a.isPinned && b.isPinned) return 1;
            const timeA = new Date(a.lastMessage?.createdAt || a.updatedAt || a.createdAt || 0).getTime();
            const timeB = new Date(b.lastMessage?.createdAt || b.updatedAt || b.createdAt || 0).getTime();
            return timeB - timeA;
          });
          return merged;
        });

        const savedRoomId = typeof localStorage !== 'undefined' ? localStorage.getItem('elite_active_chat_room_id') : null;
        const persistentId = activeGroupIdRef.current || (activeGroupRef.current ? activeGroupRef.current._id : null) || savedRoomId;

        setActiveGroup((prev) => {
          const currentId = prev?._id || persistentId;
          if (currentId) {
            const matched = res.data.find((g) => String(g._id) === String(currentId));
            if (matched) return matched;
            if (prev) return prev;
          }

          // CRITICAL: On mobile screens, NEVER auto-select or open any room! Always show the Chats list inbox screen!
          const isMobile = typeof window !== 'undefined' && (window.innerWidth < 768 || isMobileScreen);
          if (isMobile) {
            return null;
          }
          if (savedRoomId) {
            const matched = res.data.find((g) => String(g._id) === String(savedRoomId));
            if (matched) return matched;
          }
          return res.data.length > 0 ? res.data[0] : null;
        });
      }
    } catch (err) {
      console.error('Failed to fetch communication groups:', err);
    } finally {
      if (showLoader) setLoadingGroups(false);
    }
  };

  const fetchGroupMessages = async (groupId, filter, showLoader = false) => {
    if (!groupId) return;
    if (showLoader) {
      setLoadingMessages(true);
      setStreamHistoryError(null);
    }
    try {
      const params = { limit: 50 };
      if (filter === 'human' || filter === 'system_activity') {
        params.msgType = filter;
      }

      // Safety timeout: prevent loading state from hanging indefinitely (>8s)
      const timeoutPromise = new Promise((_, reject) =>
        setTimeout(() => reject(new Error('Network timeout loading stream history')), 8000)
      );

      const fetchPromise = api.getCommunicationMessages(groupId, params);
      const res = await Promise.race([fetchPromise, timeoutPromise]);

      // If user navigated away to another room before response arrived, drop stale payload
      if (activeGroupIdRef.current && String(activeGroupIdRef.current) !== String(groupId)) {
        return;
      }

      if (res && res.success && res.data) {
        let list = res.data;
        if (filter === 'urgent') {
          list = list.filter((m) => m.priority === 'urgent');
        } else if (filter === 'media') {
          list = list.filter((m) => m.attachment && m.attachment.fileUrl);
        }
        setMessages(list);
        setPage(1);
        setHasMoreMessages(list.length >= 50);
        hasMoreMessagesRef.current = list.length >= 50;
        setStreamHistoryError(null);

        if (!filter || filter === 'all') {
          messagesCacheRef.current[groupId] = list;
        }

        const myId = currentUser?._id || currentUser?.id;
        if (socket && myId && groupId) {
          socket.emit('read-room-messages', { roomId: groupId, userId: myId });
          socket.emit('sync-delivered', { roomId: groupId, userId: myId });
        }
        setGroups((prev) =>
          prev.map((g) => (String(g._id) === String(groupId) ? { ...g, unreadCount: 0 } : g))
        );
      } else {
        if (!activeGroupIdRef.current || String(activeGroupIdRef.current) === String(groupId)) {
          setStreamHistoryError(res?.message || 'Failed to load stream history');
        }
      }
    } catch (err) {
      console.error('Failed to fetch group messages:', err);
      if (!activeGroupIdRef.current || String(activeGroupIdRef.current) === String(groupId)) {
        setStreamHistoryError(err.message || 'Network timeout loading stream history');
      }
    } finally {
      if (!activeGroupIdRef.current || String(activeGroupIdRef.current) === String(groupId)) {
        setLoadingMessages(false);
      }
    }
  };

  const pollLatestGroupMessages = async (groupId, filter) => {
    if (!groupId) return;
    try {
      const params = { limit: 50 };
      if (filter === 'human' || filter === 'system_activity') {
        params.msgType = filter;
      }
      const res = await api.getCommunicationMessages(groupId, params);
      if (activeGroupIdRef.current && String(activeGroupIdRef.current) !== String(groupId)) {
        return;
      }
      if (res && res.success && res.data) {
        let incoming = res.data;
        if (filter === 'urgent') {
          incoming = incoming.filter((m) => m.priority === 'urgent');
        } else if (filter === 'media') {
          incoming = incoming.filter((m) => m.attachment && m.attachment.fileUrl);
        }
        // S3 FIX: Monotonically merge incoming messages without wiping loaded older history or resetting pagination
        setMessages((prev) => mergeMessages(prev, incoming));

        const myId = currentUser?._id || currentUser?.id;
        if (socket && socket.connected && myId && groupId) {
          socket.emit('read-room-messages', { roomId: groupId, userId: myId });
          socket.emit('sync-delivered', { roomId: groupId, userId: myId });
        }
      }
    } catch (err) {
      // Background poll failure is silent
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
        // Start with only the current user selected instead of all members
        const currentIdStr = uId ? String(uId) : null;
        setSelectedMemberIds(currentIdStr ? [currentIdStr] : []);
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
        members: selectedMemberIds,
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

  const processFileUpload = async (file) => {
    if (!file) return;

    // Upfront 10MB limit enforcement for Chat
    const MAX_CHAT_SIZE = 10 * 1024 * 1024;
    if (file.size > MAX_CHAT_SIZE) {
      alert(`File size exceeds 10MB limit (selected: ${(file.size / (1024 * 1024)).toFixed(1)}MB). Please choose a file under 10MB.`);
      return;
    }

    const FORBIDDEN_EXTS = [
      '.exe', '.bat', '.cmd', '.sh', '.bash', '.php', '.phtml',
      '.cgi', '.pl', '.py', '.vbs', '.msi', '.jar', '.scr', '.html', '.htm',
      '.bin', '.dll', '.so', '.com'
    ];

    const ext = file.type ? file.type.split('/')[1] || 'png' : 'png';
    let rawFileName = file.name || '';
    if (!rawFileName || rawFileName.toLowerCase() === 'blob' || rawFileName === 'blob.blob') {
      rawFileName = `upload-${new Date().toISOString().replace(/[:.]/g, '-')}.${ext}`;
    }
    const lowerName = rawFileName.toLowerCase();
    const fileExt = '.' + (lowerName.split('.').pop() || '');

    if (FORBIDDEN_EXTS.includes(fileExt)) {
      alert(`File type "${fileExt}" is blocked for security reasons. Executables and binary files cannot be uploaded to chat.`);
      return;
    }

    const isImage = file.type?.startsWith('image/') || /\.(jpg|jpeg|png|webp|gif|svg|bmp)$/i.test(lowerName);
    const isPdf = file.type === 'application/pdf' || lowerName.endsWith('.pdf');
    const isAudio = file.type?.startsWith('audio/') || /\.(mp3|wav|ogg|m4a|aac)$/i.test(lowerName);
    const isSpreadsheet = /\.(xls|xlsx|csv)$/i.test(lowerName);

    setUploadingFile(true);
    try {
      const roomName = activeGroup?.name || 'General';
      const cleanRoom = String(roomName || 'General').trim().replace(/[^a-zA-Z0-9_\-\s]/g, '').replace(/\s+/g, '_');
      const fileInfo = await uploadChatFileToR2(file, {
        folder: `Chat/${cleanRoom}`,
        useChatEndpoint: true
      });

      if (fileInfo && fileInfo.fileUrl) {
        let safeName = fileInfo.fileName || rawFileName || '';
        if (!safeName || safeName.toLowerCase() === 'blob' || safeName.toLowerCase() === 'blob.blob' || safeName.startsWith('blob:')) {
          safeName = rawFileName || `image-${Date.now()}.${ext}`;
        }
        setAttachedFile({
          fileName: safeName,
          fileType: fileInfo.fileType,
          fileUrl: fileInfo.fileUrl,
          fileSize: fileInfo.fileSize || file.size,
          mimeType: fileInfo.mimeType || (isPdf ? 'application/pdf' : 'application/octet-stream')
        });
      } else {
        alert('Failed to upload attachment.');
      }
    } catch (err) {
      alert('File upload failed: ' + err.message);
    } finally {
      setUploadingFile(false);
    }
  };

  const handleFileUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    await processFileUpload(file);
    e.target.value = '';
  };

  const openFileDialog = (acceptType = 'image/*,.pdf,.doc,.docx,.xls,.xlsx,.csv,.txt,.zip,audio/*') => {
    const el = fileInputRef.current || (typeof document !== 'undefined' ? document.getElementById('phoenix-chat-file-input') : null);
    if (el) {
      try {
        el.value = '';
      } catch (e) {}
      if (acceptType) el.accept = acceptType;
      el.click();
    }
  };

  const handleChatDragEnter = (e) => {
    e.preventDefault();
    e.stopPropagation();
    chatDragCounterRef.current += 1;
    if (e.dataTransfer?.items && e.dataTransfer.items.length > 0) {
      setIsChatDragging(true);
    }
  };

  const handleChatDragOver = (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.dataTransfer) {
      e.dataTransfer.dropEffect = 'copy';
    }
    if (!isChatDragging) {
      setIsChatDragging(true);
    }
  };

  const handleChatDragLeave = (e) => {
    e.preventDefault();
    e.stopPropagation();
    chatDragCounterRef.current -= 1;
    if (chatDragCounterRef.current <= 0) {
      chatDragCounterRef.current = 0;
      setIsChatDragging(false);
    }
  };

  const handleChatDrop = async (e) => {
    e.preventDefault();
    e.stopPropagation();
    chatDragCounterRef.current = 0;
    setIsChatDragging(false);

    if (e.dataTransfer?.files && e.dataTransfer.files.length > 0) {
      const file = e.dataTransfer.files[0];
      await processFileUpload(file);
    } else if (e.dataTransfer?.items) {
      for (let i = 0; i < e.dataTransfer.items.length; i++) {
        const item = e.dataTransfer.items[i];
        if (item.kind === 'file') {
          const file = item.getAsFile();
          if (file) {
            await processFileUpload(file);
            break;
          }
        }
      }
    }
  };

  const handlePlayVoiceNote = (msgId, audioUrl) => {
    if (playingAudioId === msgId) {
      if (audioElementRef.current) {
        if (audioElementRef.current.paused) {
          audioElementRef.current.play().then(() => setIsAudioPlaying(true)).catch(() => {});
        } else {
          audioElementRef.current.pause();
          setIsAudioPlaying(false);
        }
      }
    } else {
      if (audioElementRef.current) {
        audioElementRef.current.pause();
      }
      const audio = new Audio(audioUrl);
      audio.playbackRate = playbackSpeed;
      audioElementRef.current = audio;
      setPlayingAudioId(msgId);
      setIsAudioPlaying(true);
      setAudioProgress(0);
      setAudioCurrentTime(0);

      audio.ontimeupdate = () => {
        if (audio.duration) {
          setAudioProgress((audio.currentTime / audio.duration) * 100);
          setAudioCurrentTime(audio.currentTime);
        }
      };
      audio.onended = () => {
        setPlayingAudioId(null);
        setIsAudioPlaying(false);
        setAudioProgress(0);
        setAudioCurrentTime(0);
      };
      audio.onerror = () => {
        setPlayingAudioId(null);
        setIsAudioPlaying(false);
      };
      audio.play().catch((err) => console.warn('Audio play failed/blocked:', err));
    }
  };

  const handleAudioSeek = (e, msgId, defaultDuration) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    const newPct = Math.max(0, Math.min(1, clickX / rect.width));
    if (audioElementRef.current && playingAudioId === msgId) {
      const targetDuration = audioElementRef.current.duration || defaultDuration || 1;
      audioElementRef.current.currentTime = newPct * targetDuration;
      setAudioProgress(newPct * 100);
      setAudioCurrentTime(newPct * targetDuration);
    }
  };

  const handleToggleAudioSpeed = () => {
    const speeds = [1, 1.5, 2];
    const nextIdx = (speeds.indexOf(playbackSpeed) + 1) % speeds.length;
    const nextSpeed = speeds[nextIdx];
    setPlaybackSpeed(nextSpeed);
    if (audioElementRef.current) {
      audioElementRef.current.playbackRate = nextSpeed;
    }
  };

  // ── AUDIO VOICE NOTE RECORDING & PUSH-TO-TALK HANDLERS ──
  const sendVoiceNoteMessage = async (audioAttachment) => {
    const currentGroup = activeGroupRef.current;
    if (!audioAttachment || !currentGroup) return;
    const sender = currentUserRef.current;
    const senderId = sender?.id || sender?._id;
    if (!senderId) return;

    const clientMsgId = 'client_' + Date.now() + '_' + Math.random().toString(36).slice(2, 9);
    const messageText = `Attached ${audioAttachment.fileName}`;
    const messagePayload = {
      roomId: currentGroup._id,
      senderId,
      clientMsgId,
      content: messageText,
      priority: isUrgent ? 'urgent' : 'normal',
      attachment: audioAttachment,
    };

    const tempId = 'temp_' + Date.now();
    const tempMsg = {
      _id: tempId,
      clientMsgId,
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
    setGroups((prevGroups) => {
      return prevGroups.map((g) => {
        if (String(g._id) === String(currentGroup._id)) {
          return {
            ...g,
            lastMessage: tempMsg,
            updatedAt: tempMsg.createdAt || new Date().toISOString()
          };
        }
        return g;
      });
    });
    setIsUrgent(false);

    try {
      const res = await api.sendCommunicationMessage(currentGroup._id, messagePayload);
      if (res && res.success && res.data) {
        const realMsg = { ...res.data, isOptimistic: false };
        setMessages((prev) => {
          const filtered = prev.filter((m) => m._id !== tempId && m.clientMsgId !== clientMsgId && String(m._id) !== String(realMsg._id));
          return mergeMessages(filtered, [realMsg]);
        });
        setGroups((prevGroups) => {
          return prevGroups.map((g) => {
            if (String(g._id) === String(currentGroup._id)) {
              return {
                ...g,
                lastMessage: realMsg,
                updatedAt: realMsg.createdAt || new Date().toISOString()
              };
            }
            return g;
          });
        });
      }
    } catch (err) {
      console.warn('HTTP post message failed, falling back to socket emit:', err.message);
      if (socket && socket.connected) {
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

    const clientMsgId = 'client_' + Date.now() + '_' + Math.random().toString(36).slice(2, 9);
    const tempMsg = {
      _id: 'temp_' + Date.now(),
      clientMsgId,
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
      clientMsgId,
      content: cardTitle,
      type: 'record-card',
      activityMeta: actMeta,
      recordMentions: [{ recordType: shareRecordCategory, recordRef: refVal }]
    };

    api.sendCommunicationMessage(targetRoomId, messagePayload)
      .then((res) => {
        if (res && res.success && res.data) {
          if (isCurrentRoom) {
            const realMsg = { ...res.data, isOptimistic: false };
            setMessages((prev) => {
              const filtered = prev.filter((m) => m._id !== tempMsg._id && m.clientMsgId !== clientMsgId && String(m._id) !== String(realMsg._id));
              return mergeMessages(filtered, [realMsg]);
            });
          }
        }
        fetchGroups(false);
      })
      .catch((err) => {
        console.warn('HTTP share record card failed, falling back to socket emit:', err.message);
        if (socket && socket.connected) {
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
    setTimeout(() => {
      URL.revokeObjectURL(url);
    }, 2000);
  };

  // Universal Download Helper: Saves with exact original filename without opening new tabs
  const handleDownloadAttachment = async (url, name) => {
    if (!url) return;
    const cleanName = name || 'download';

    // Safe helper to trigger file save from blob
    const triggerBlobDownload = (blob) => {
      const blobUrl = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = blobUrl;
      link.download = cleanName;
      document.body.appendChild(link);
      link.click();
      setTimeout(() => {
        if (link.parentNode) link.parentNode.removeChild(link);
        window.URL.revokeObjectURL(blobUrl);
      }, 60000);
    };

    // 1. Try direct fetch first
    try {
      const response = await fetch(url);
      if (response.ok) {
        const blob = await response.blob();
        triggerBlobDownload(blob);
        return;
      }
    } catch (e) {
      // Direct CORS blocked, fallback to backend download proxy
    }

    // 2. Fetch via backend download proxy with auth
    try {
      const proxyUrl = `/v1/upload/download?url=${encodeURIComponent(url)}&filename=${encodeURIComponent(cleanName)}`;
      const res = await authFetch(proxyUrl);
      if (res.ok) {
        const blob = await res.blob();
        triggerBlobDownload(blob);
        return;
      }
    } catch (err) {
      console.warn('[handleDownloadAttachment] Proxy fetch error:', err);
    }

    // 3. Fallback: Browser download navigation link
    const finalUrl = `/v1/upload/download?url=${encodeURIComponent(url)}&filename=${encodeURIComponent(cleanName)}`;
    const link = document.createElement('a');
    link.href = finalUrl;
    link.download = cleanName;
    link.target = '_blank';
    document.body.appendChild(link);
    link.click();
    setTimeout(() => {
      if (link.parentNode) link.parentNode.removeChild(link);
    }, 60000);
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

  // Clipboard Paste Handler (Supports Ctrl+V / Cmd+V for PDFs, Documents, Screenshots & Images)
  const handlePasteClipboard = async (e) => {
    let file = null;

    // 1. Check e.clipboardData.files first (Finder / File Explorer copied files, PDFs, images)
    if (e.clipboardData?.files && e.clipboardData.files.length > 0) {
      file = e.clipboardData.files[0];
    }

    // 2. Fallback to e.clipboardData.items (Browser screenshots, canvas blobs)
    if (!file && e.clipboardData?.items) {
      for (let i = 0; i < e.clipboardData.items.length; i++) {
        const item = e.clipboardData.items[i];
        if (item.kind === 'file') {
          const f = item.getAsFile();
          if (f) {
            file = f;
            break;
          }
        }
      }
    }

    if (file) {
      e.preventDefault();
      await processFileUpload(file);
    }
  };

  const mentionCandidates = useMemo(() => {
    if (mentionQuery === null) return [];

    let storedUser = null;
    try {
      if (typeof localStorage !== 'undefined') {
        const raw = localStorage.getItem('user');
        if (raw) storedUser = JSON.parse(raw);
      }
    } catch (e) {}

    const myIds = new Set([
      String(currentUser?._id || ''),
      String(currentUser?.id || ''),
      String(storedUser?._id || ''),
      String(storedUser?.id || '')
    ].filter(Boolean));

    const myEmails = new Set([
      String(currentUser?.email || '').trim().toLowerCase(),
      String(storedUser?.email || '').trim().toLowerCase()
    ].filter(Boolean));

    const myUsernames = new Set([
      String(currentUser?.username || '').trim().toLowerCase(),
      String(storedUser?.username || '').trim().toLowerCase()
    ].filter(Boolean));

    const myNames = new Set([
      String(currentUser?.name || '').trim().toLowerCase(),
      String(storedUser?.name || '').trim().toLowerCase()
    ].filter(Boolean));

    let usersToSearch = allUsers || [];
    if (activeGroup?.type === 'group' && Array.isArray(activeGroup.members) && activeGroup.members.length > 0) {
      const memberIdSet = new Set(
        activeGroup.members.map((m) => String(typeof m === 'object' ? (m._id || m.id) : m))
      );
      const groupUsers = allUsers.filter((u) => memberIdSet.has(String(u._id || u.id)));
      if (groupUsers.length > 0) usersToSearch = groupUsers;
    }

    const q = mentionQuery.trim().toLowerCase();

    // Exclude logged in user ("me")
    const filteredUsers = usersToSearch
      .filter((u) => {
        const uid = String(u._id || u.id || '');
        if (uid && myIds.has(uid)) return false;
        const uEmail = String(u.email || '').trim().toLowerCase();
        if (uEmail && myEmails.has(uEmail)) return false;
        const uUsername = String(u.username || '').trim().toLowerCase();
        if (uUsername && myUsernames.has(uUsername)) return false;
        const uName = String(u.name || '').trim().toLowerCase();
        if (uName && myNames.has(uName)) return false;
        return true;
      })
      .filter((u) => {
        if (!q) return true;
        const name = (u.name || '').toLowerCase();
        const username = (u.username || '').toLowerCase();
        return name.includes(q) || username.includes(q);
      });

    const candidates = [];

    // Prepend @ERP-Core Orchestrator autonomous operational agent
    if (!q || 'erp-core orchestrator'.includes(q) || 'orchestrator'.includes(q) || 'bot'.includes(q) || 'ai'.includes(q) || 'agent'.includes(q)) {
      candidates.push({
        _id: 'ORCHESTRATOR_BOT',
        id: 'ORCHESTRATOR_BOT',
        name: 'ERP-Core Orchestrator',
        displayName: 'ERP-Core Orchestrator',
        title: '⚡ ERP-Core Orchestrator',
        role: 'Autonomous Operational Agent (Production, Stock, Billing)',
        isOrchestrator: true
      });
    }

    // Prepend @all / Everyone option for group or channel chats
    const canMentionAll = !activeGroup || activeGroup.type === 'group' || (activeGroup.members && activeGroup.members.length > 1);
    if (canMentionAll && (!q || 'all'.startsWith(q) || 'everyone'.startsWith(q))) {
      candidates.push({
        _id: 'ALL_MEMBERS',
        id: 'ALL_MEMBERS',
        name: 'all',
        displayName: 'all',
        title: 'All Members',
        role: 'Notify all members in this conversation',
        isSpecialAll: true
      });
    }

    candidates.push(...filteredUsers.slice(0, 6));
    return candidates;
  }, [mentionQuery, allUsers, activeGroup, currentUser]);

  const handleSelectMention = (user) => {
    const isAll = user.isSpecialAll || user._id === 'ALL_MEMBERS' || user.name === 'all';
    const isBot = user.isOrchestrator || user._id === 'ORCHESTRATOR_BOT';
    const textarea = chatTextareaRef.current;
    const cursorPos = textarea?.selectionStart ?? inputMessage.length;

    const textBeforeCursor = inputMessage.slice(0, cursorPos);
    const textAfterCursor = inputMessage.slice(cursorPos);
    const replacedBefore = textBeforeCursor.replace(/(?:^|\s)@([a-zA-Z0-9._-]*(?:\s[a-zA-Z0-9._-]+)?)$/, (match) => {
      const leadingSpace = match.startsWith(' ') ? ' ' : '';
      return `${leadingSpace}${isAll ? '@all ' : isBot ? '@ERP-Core Orchestrator ' : `@${user.name || user.username || 'User'} `}`;
    });

    const newMsg = replacedBefore + textAfterCursor;
    setInputMessage(newMsg);

    if (isAll) {
      const allMemberIds = (activeGroup?.members || []).map((m) =>
        String(typeof m === 'object' ? (m._id || m.id) : m)
      ).filter(Boolean);
      setMentionedUserIds((prev) => Array.from(new Set([...prev, 'ALL_MEMBERS', ...allMemberIds])));
    } else {
      const uId = String(user._id || user.id);
      setMentionedUserIds((prev) => Array.from(new Set([...prev, uId])));
    }
    setMentionQuery(null);

    setTimeout(() => {
      if (textarea) {
        textarea.focus();
        const newPos = replacedBefore.length;
        textarea.setSelectionRange(newPos, newPos);
      }
    }, 50);
  };

  const handleInputChange = (e) => {
    const val = e.target.value;
    setInputMessage(val);
    if (activeGroup?._id) {
      setRoomDrafts((prev) => ({ ...prev, [activeGroup._id]: val }));
    }

    const cursorPos = e.target.selectionStart;
    const textBeforeCursor = val.slice(0, cursorPos);
    const atMatch = textBeforeCursor.match(/(?:^|\s)@([a-zA-Z0-9._-]*(?:\s[a-zA-Z0-9._-]+)?)$/);
    if (atMatch) {
      setMentionQuery(atMatch[1].toLowerCase());
      setMentionIndex(0);
    } else {
      setMentionQuery(null);
    }

    if (activeGroup?._id && socket) {
      const myName = currentUser?.name || currentUser?.username || 'Staff';
      if (!isTypingRef.current) {
        isTypingRef.current = true;
        socket.emit('typing', { roomId: activeGroup._id, username: myName, isTyping: true });
      }
      if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
      typingTimeoutRef.current = setTimeout(() => {
        isTypingRef.current = false;
        socket.emit('typing', { roomId: activeGroup._id, username: myName, isTyping: false });
      }, 2500);
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

      const clientMsgId = 'client_' + Date.now() + '_' + Math.random().toString(36).slice(2, 9);
      const res = await api.sendCommunicationMessage(activeGroup._id, {
        clientMsgId,
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
    const el = chatScrollRef.current;
    if (!el || !activeGroup) return;

    // Track user distance from bottom to preserve pinned status on incoming messages
    const distanceFromBottom = el.scrollHeight - el.scrollTop - el.clientHeight;
    const isAtBottom = distanceFromBottom <= 140;
    isNearBottomRef.current = isAtBottom;
    setShowScrollBottom(!isAtBottom);
    if (isAtBottom) {
      setUnreadBelowCount(0);
    }

    // Only load older messages if container actually overflows and user deliberately scrolled to the top
    if (loadingOlderRef.current || !hasMoreMessagesRef.current) return;
    if (el.scrollHeight > el.clientHeight + 60 && el.scrollTop <= 120) {
      loadingOlderRef.current = true;
      setLoadingMoreMessages(true);
      const scrollHeightBefore = el.scrollHeight;
      const requestedGroupId = activeGroup._id;

      try {
        const oldestRealMsg = messages.find((m) => m && m._id && !m.isOptimistic && !String(m._id).startsWith('temp_'));
        const params = { limit: 50 };
        if (oldestRealMsg && oldestRealMsg._id) {
          params.before = String(oldestRealMsg._id);
        } else {
          params.page = page + 1;
        }
        if (msgFilter === 'human' || msgFilter === 'system_activity') params.msgType = msgFilter;

        const res = await api.getCommunicationMessages(requestedGroupId, params);
        // RC7 FIX: Drop response if user switched to another room while request was in-flight
        if (activeGroupIdRef.current && String(activeGroupIdRef.current) !== String(requestedGroupId)) {
          return;
        }

        if (res && res.success && res.data) {
          const incoming = res.data || [];
          if (incoming.length < 50) {
            setHasMoreMessages(false);
            hasMoreMessagesRef.current = false;
          }
          // Monotonically merge and deduplicate to eliminate duplicate pairs on prepend
          setMessages((prev) => mergeMessages(prev, incoming));
          setPage((p) => p + 1);

          requestAnimationFrame(() => {
            if (chatScrollRef.current) {
              chatScrollRef.current.scrollTop = chatScrollRef.current.scrollHeight - scrollHeightBefore;
            }
          });
        } else {
          setHasMoreMessages(false);
          hasMoreMessagesRef.current = false;
        }
      } catch (err) {
        console.error('Failed to load older messages:', err);
      } finally {
        loadingOlderRef.current = false;
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
    if (e && e.preventDefault) e.preventDefault();
    if (uploadingFile) {
      alert('Please wait for the attachment to finish uploading before sending.');
      return;
    }
    if ((!inputMessage.trim() && !attachedFile) || !activeGroup) return;

    if (editingMessage) {
      const msgId = editingMessage._id;
      const editedContent = inputMessage.trim();
      if (!editedContent) return;

      setMessages((prev) =>
        prev.map((m) =>
          String(m._id) === String(msgId)
            ? { ...m, content: editedContent, isEdited: true }
            : m
        )
      );

      if (api.editCommunicationMessage) {
        api.editCommunicationMessage(msgId, editedContent).catch((err) => {
          console.warn('HTTP edit message error, socket fallback active:', err.message);
        });
      }

      if (socket && activeGroup?._id) {
        socket.emit('edit-message', {
          messageId: msgId,
          newContent: editedContent,
          roomId: activeGroup._id
        });
      }

      setEditingMessage(null);
      setInputMessage('');
      return;
    }

    const senderId = currentUser?.id || currentUser?._id;
    if (!senderId) {
      alert('User session not loaded. Please log in again.');
      return;
    }

    const messageText = inputMessage.trim();

    const finalMentionedUserIds = Array.from(
      new Set([
        ...mentionedUserIds,
        ...(allUsers || [])
          .filter((u) => {
            const name = u.name || u.username;
            return name && messageText.includes(`@${name}`);
          })
          .map((u) => String(u._id || u.id)),
      ])
    );

    const clientMsgId = 'client_' + Date.now() + '_' + Math.random().toString(36).slice(2, 9);

    const messagePayload = {
      roomId: activeGroup._id,
      senderId,
      clientMsgId,
      content: messageText,
      priority: isUrgent ? 'urgent' : 'normal',
      replyTo: replyToMessage ? replyToMessage._id : undefined,
      attachment: attachedFile || undefined,
      mentionedUserIds: finalMentionedUserIds.length > 0 ? finalMentionedUserIds : undefined,
    };

    const tempId = 'temp_' + Date.now();
    const tempMsg = {
      _id: tempId,
      clientMsgId,
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
      isOptimistic: true,
      sendFailed: false
    };

    setMessages((prev) => [...prev, tempMsg]);
    setGroups((prevGroups) => {
      return prevGroups.map((g) => {
        if (String(g._id) === String(activeGroup._id)) {
          return {
            ...g,
            lastMessage: tempMsg,
            updatedAt: tempMsg.createdAt || new Date().toISOString()
          };
        }
        return g;
      });
    });
    isNearBottomRef.current = true;
    setShowScrollBottom(false);
    setUnreadBelowCount(0);
    requestAnimationFrame(() => {
      if (chatScrollRef.current) {
        chatScrollRef.current.scrollTop = chatScrollRef.current.scrollHeight;
      }
    });

    setInputMessage('');
    setAttachedFile(null);
    setReplyToMessage(null);
    setIsUrgent(false);
    setMentionQuery(null);
    setMentionedUserIds([]);

    if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
    if (isTypingRef.current && socket && activeGroup?._id) {
      isTypingRef.current = false;
      socket.emit('typing', { roomId: activeGroup._id, username: currentUser?.name || 'Staff', isTyping: false });
    }

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
        const realMsg = { ...res.data, isOptimistic: false };
        setMessages((prev) => {
          const filtered = prev.filter((m) => m._id !== tempId && m.clientMsgId !== clientMsgId && String(m._id) !== String(realMsg._id));
          return mergeMessages(filtered, [realMsg]);
        });
        setGroups((prevGroups) => {
          return prevGroups.map((g) => {
            if (String(g._id) === String(activeGroup._id)) {
              return {
                ...g,
                lastMessage: realMsg,
                updatedAt: realMsg.createdAt || new Date().toISOString()
              };
            }
            return g;
          });
        });
      } else {
        throw new Error(res?.message || 'Server did not acknowledge message saving');
      }
    } catch (err) {
      console.warn('HTTP post message failed, falling back to socket emit or error flag:', err.message);
      if (socket && socket.connected) {
        let ackResolved = false;
        const fallbackTimer = setTimeout(() => {
          if (!ackResolved) {
            setMessages((prev) =>
              prev.map((m) =>
                m._id === tempId || m.clientMsgId === clientMsgId
                  ? { ...m, isOptimistic: false, sendFailed: true, sendError: 'Send timed out' }
                  : m
              )
            );
          }
        }, 5000);

        socket.emit('send-message', messagePayload, (ack) => {
          ackResolved = true;
          clearTimeout(fallbackTimer);
          const ackMsg = ack?.message || ack?.data;
          if (ack?.success && ackMsg) {
            setMessages((prev) => {
              const filtered = prev.filter((m) => m._id !== tempId && m.clientMsgId !== clientMsgId && String(m._id) !== String(ackMsg._id));
              return mergeMessages(filtered, [{ ...ackMsg, isOptimistic: false }]);
            });
            setGroups((prevGroups) => {
              return prevGroups.map((g) => {
                if (String(g._id) === String(activeGroup._id)) {
                  return {
                    ...g,
                    lastMessage: ackMsg,
                    updatedAt: ackMsg.createdAt || new Date().toISOString()
                  };
                }
                return g;
              });
            });
          } else {
            setMessages((prev) =>
              prev.map((m) =>
                m._id === tempId || m.clientMsgId === clientMsgId
                  ? { ...m, isOptimistic: false, sendFailed: true, sendError: ack?.error || 'Send failed' }
                  : m
              )
            );
          }
        });
      } else {
        setMessages((prev) =>
          prev.map((m) =>
            m._id === tempId || m.clientMsgId === clientMsgId
              ? { ...m, isOptimistic: false, sendFailed: true, sendError: err.message || 'Send failed' }
              : m
          )
        );
      }
    }
  };

  const handleRetryFailedMessage = async (failedMsg) => {
    if (!failedMsg || !activeGroup?._id) return;
    const senderId = currentUser?.id || currentUser?._id;
    const clientMsgId = failedMsg.clientMsgId || failedMsg._id;
    const messagePayload = {
      roomId: activeGroup._id,
      senderId,
      clientMsgId,
      content: failedMsg.content || '',
      priority: failedMsg.priority || 'normal',
      replyTo: failedMsg.replyTo ? (failedMsg.replyTo._id || failedMsg.replyTo) : undefined,
      attachment: failedMsg.attachment || undefined,
    };
    setMessages((prev) =>
      prev.map((m) =>
        m._id === failedMsg._id
          ? { ...m, isOptimistic: true, sendFailed: false, sendError: null }
          : m
      )
    );
    try {
      const res = await api.sendCommunicationMessage(activeGroup._id, messagePayload);
      if (res && res.success && res.data) {
        setMessages((prev) =>
          prev.map((m) => (m._id === failedMsg._id ? { ...res.data, isOptimistic: false, sendFailed: false } : m))
        );
      } else {
        throw new Error(res?.message || 'Server rejected retry');
      }
    } catch (err) {
      console.warn('Retry failed:', err.message);
      setMessages((prev) =>
        prev.map((m) =>
          m._id === failedMsg._id
            ? { ...m, isOptimistic: false, sendFailed: true, sendError: err.message || 'Retry failed' }
            : m
        )
      );
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
    setIsEditingMembers(false);

    // Optimistically pre-populate members from activeGroup.members if available
    if (Array.isArray(activeGroup.members) && activeGroup.members.length > 0) {
      const immediateMembers = activeGroup.members.map((m) => {
        if (typeof m === 'object' && m !== null) return m;
        const matched = (allUsers || []).find((u) => String(u._id || u.id) === String(m));
        return matched || { _id: m, name: 'Staff Member', email: '' };
      });
      setGroupMembers(immediateMembers);
      setEditMemberIds(immediateMembers.map((m) => String(m._id || m.id || m)));
    }

    setLoadingMembers(true);
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
    // Never auto-select or force room switches upon changing filter/list views
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

    let baseItems = [];
    if (phoenixFilter === 'groups' || rosterTab === 'groups') {
      baseItems = groups.filter((g) => g.type !== 'direct');
    } else if (phoenixFilter === 'direct' || phoenixFilter === 'personal' || rosterTab === 'direct') {
      baseItems = groups.filter((g) => g.type === 'direct');
    } else {
      // 'all': WhatsApp style: ALL active groups and active DMs merged together
      baseItems = [...groups];
    }

    // Filter by Phoenix Segmented Tabs: All | Personal | Groups | Unread
    if (phoenixFilter === 'read') {
      baseItems = baseItems.filter((g) => (Number(g.unreadCount) || 0) === 0);
    } else if (phoenixFilter === 'unread') {
      baseItems = baseItems.filter((g) => (Number(g.unreadCount) || 0) > 0);
    }

    // WhatsApp Recency Sorting Helper:
    // Determine the most recent activity timestamp for each chat room
    const getChatTimestamp = (g) => {
      const msgTime = g.lastMessage?.createdAt;
      const t = msgTime || g.updatedAt || g.createdAt || 0;
      const parsed = new Date(t).getTime();
      return isNaN(parsed) ? 0 : parsed;
    };

    // Sort WhatsApp-style: Most recent message sent/received always appears at the top!
    baseItems.sort((a, b) => {
      if (a.isPinned && !b.isPinned) return -1;
      if (!a.isPinned && b.isPinned) return 1;
      return getChatTimestamp(b) - getChatTimestamp(a);
    });

    // When NO search query is typed, show ONLY existing chats sorted WhatsApp style
    if (!term) return baseItems;

    // Filter existing chats matching the search term
    const matchedExisting = baseItems.filter((item) => {
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

    // When searching, also search staff directory for new people to message
    const matchedStaff = (allUsers || []).filter((u) => {
      const uId = String(u._id || u.id || '');
      if (!uId || uId === myId || existingDmUserIds.has(uId)) return false;
      const uName = (u.name || u.username || u.email || '').toLowerCase();
      const uDept = (u.department || '').toLowerCase();
      const uRole = (u.role || '').toLowerCase();
      return uName.includes(term) || uDept.includes(term) || uRole.includes(term);
    }).map((u) => ({
      _id: `contact_${u._id || u.id}`,
      isVirtualContact: true,
      user: u,
      name: u.name || u.username || u.email || 'Colleague',
      type: 'direct',
      department: u.department || 'General',
      unreadCount: 0
    }));

    return [...matchedExisting, ...matchedStaff];
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
      if (isNaN(date.getTime())) return '';
      return date.toLocaleTimeString('en-IN', {
        hour: 'numeric',
        minute: '2-digit',
        hour12: true,
        timeZone: 'Asia/Kolkata'
      });
    } catch (e) {
      return '';
    }
  };

  const formatChatListTime = (isoString) => {
    if (!isoString) return '';
    try {
      const date = new Date(isoString);
      if (isNaN(date.getTime())) return '';
      const now = new Date();
      const isToday = date.toDateString() === now.toDateString();
      if (isToday) {
        return date.toLocaleTimeString('en-IN', {
          hour: 'numeric',
          minute: '2-digit',
          hour12: true,
          timeZone: 'Asia/Kolkata'
        });
      }
      const yesterday = new Date(now);
      yesterday.setDate(yesterday.getDate() - 1);
      if (date.toDateString() === yesterday.toDateString()) {
        return 'Yesterday';
      }
      return date.toLocaleDateString('en-GB', {
        day: '2-digit',
        month: 'short',
        timeZone: 'Asia/Kolkata'
      });
    } catch (e) {
      return '';
    }
  };

  const formatMessageTime = formatTime;

  const formatDateLabel = (dtStr) => {
    if (!dtStr) return '';
    try {
      const dt = new Date(dtStr);
      if (isNaN(dt.getTime())) return '';
      return dt.toLocaleDateString('en-IN', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
        timeZone: 'Asia/Kolkata'
      });
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

  const renderTextSegmentWithUrls = (str, keyPrefix) => {
    if (!str) return null;
    const urlRegex = /(https?:\/\/[^\s]+)/gi;
    const parts = str.split(urlRegex);
    return parts.map((part, pIdx) => {
      if (urlRegex.test(part)) {
        return (
          <a
            key={`${keyPrefix}_url_${pIdx}`}
            href={part}
            target="_blank"
            rel="noopener noreferrer"
            style={{
              color: '#2563eb',
              textDecoration: 'underline',
              wordBreak: 'break-all',
              fontWeight: 600
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {part}
          </a>
        );
      }
      return part;
    });
  };

  const renderContentWithMentions = (text, msg = null) => {
    if (!text) return null;

    // Collect all candidate user mention names from msg.mentions, allUsers, activeGroup.members, and broadcast tags
    const candidateNames = new Set(['all', 'everyone', 'channel']);

    if (msg && Array.isArray(msg.mentions)) {
      msg.mentions.forEach((u) => {
        if (typeof u === 'object' && u) {
          if (u.name && u.name.trim()) candidateNames.add(u.name.trim());
          if (u.username && u.username.trim()) candidateNames.add(u.username.trim());
        }
      });
    }

    if (Array.isArray(allUsers)) {
      allUsers.forEach((u) => {
        if (u.name && u.name.trim()) candidateNames.add(u.name.trim());
        if (u.username && u.username.trim()) candidateNames.add(u.username.trim());
      });
    }

    if (activeGroup && Array.isArray(activeGroup.members)) {
      activeGroup.members.forEach((m) => {
        if (typeof m === 'object' && m) {
          if (m.name && m.name.trim()) candidateNames.add(m.name.trim());
          if (m.username && m.username.trim()) candidateNames.add(m.username.trim());
        }
      });
    }

    // Sort by length DESCENDING so longer multi-word names (e.g. "QA Automation Bot") match before subnames ("QA")
    const sortedNames = Array.from(candidateNames)
      .filter((n) => n && n.length > 0)
      .sort((a, b) => b.length - a.length);

    const escapedNames = sortedNames.map((n) => n.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));

    let combinedRegex;
    if (escapedNames.length > 0) {
      combinedRegex = new RegExp(
        `(@(?:JC|DES|INV)-[a-zA-Z0-9_-]+)|(@(?:${escapedNames.join('|')}))(?=[\\s,.:;!?)]|$)|(@[a-zA-Z0-9._-]+)`,
        'gi'
      );
    } else {
      combinedRegex = /(@(?:JC|DES|INV)-[a-zA-Z0-9_-]+)|(@[a-zA-Z0-9._-]+)/gi;
    }

    const elements = [];
    let lastIndex = 0;
    const matches = [...text.matchAll(combinedRegex)];

    if (matches.length === 0) return renderTextSegmentWithUrls(text, 'plain');

    matches.forEach((m, idx) => {
      const matchText = m[0];
      const matchIndex = m.index;
      if (matchIndex > lastIndex) {
        elements.push(renderTextSegmentWithUrls(text.substring(lastIndex, matchIndex), `seg_${idx}`));
      }

      if (m[1]) {
        // Record mention (@JC-..., @DES-..., @INV-...)
        const prefix = matchText.substring(1, matchText.indexOf('-')).toUpperCase();
        elements.push(
          <button
            key={`rec_${idx}`}
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
      } else {
        // User mention (@Full Name, @Username, or @all / @everyone)
        const isAllTag = matchText.toLowerCase() === '@all' || matchText.toLowerCase() === '@everyone';
        elements.push(
          <span
            key={`usr_${idx}`}
            style={{
              display: 'inline-block',
              background: isAllTag ? 'rgba(245, 158, 11, 0.18)' : 'rgba(59, 130, 246, 0.16)',
              color: isAllTag ? '#b45309' : '#1d4ed8',
              fontWeight: 800,
              borderRadius: '4px',
              padding: '0 6px',
              margin: '0 2px',
              fontSize: '0.86rem',
              border: isAllTag ? '1px solid rgba(245, 158, 11, 0.35)' : 'none'
            }}
          >
            {matchText}
          </span>
        );
      }

      lastIndex = matchIndex + matchText.length;
    });

    if (lastIndex < text.length) {
      elements.push(renderTextSegmentWithUrls(text.substring(lastIndex), 'tail'));
    }

    return elements;
  };

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        width: '100%',
        flex: 1,
        minHeight: 0,
        height: '100%',
        maxHeight: '100%',
        padding: isMobileScreen ? 0 : '0.85rem',
        boxSizing: 'border-box',
        overflow: 'hidden',
        background: isMobileScreen ? 'var(--bg-card, #ffffff)' : 'var(--bg-main, #f5f7fa)'
      }}
    >
      {/* ── MAIN CONTENT VIEW (IF TASK MODE: FULL TASK PANEL | IF CHAT MODE: PHOENIX CHAT LAYOUT) ── */}
      {mainTab === 'task' ? (
        <div style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>
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
          <div style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>
            <TaskManagerPanel currentUser={currentUser} onNavigateTab={onNavigateTab} />
          </div>
        </div>
      ) : (
      <div className="phoenix-chat-layout" style={{ display: 'flex', flexDirection: 'row', width: '100%', height: '100%', flex: 1, minHeight: 0, overflow: 'hidden' }}>
        
        {/* ════ LEFT COLUMN: PHOENIX CONVERSATIONS SIDEBAR ════ */}
        <div className={`phoenix-chat-sidebar ${(isMobileScreen && activeGroup) ? 'is-mobile-hidden is-hidden' : ''}`} style={{ display: (isMobileScreen && activeGroup) ? 'none' : 'flex', flexDirection: 'column' }}>
          
          {/* Phoenix Sidebar Top Bar: Chats title + Presence + Task toggle + Add Chat button */}
          <div style={{ padding: '0.85rem 1rem 0.65rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0, borderBottom: '1px solid var(--border-light, #e3e6ed)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <h2 style={{ margin: 0, fontSize: '1.18rem', fontWeight: 800, color: 'var(--text-primary, #141824)', letterSpacing: '-0.02em' }}>
                Chats
              </h2>
              <span
                style={{
                  width: 8,
                  height: 8,
                  borderRadius: '50%',
                  background: isSocketConnected ? '#25b865' : '#f59e0b',
                  display: 'inline-block'
                }}
                title={isSocketConnected ? "Live Presence Active" : "Reconnecting to server..."}
              />
              {!isSocketConnected && (
                <span style={{ fontSize: '0.68rem', color: '#d97706', fontWeight: 700 }}>
                  Reconnecting...
                </span>
              )}
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

          {/* Phoenix Filter Segmented Tabs (All | Personal | Groups | Unread) */}
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
                className={`phoenix-tab-pill ${phoenixFilter === 'direct' ? 'active' : ''}`}
                onClick={() => setPhoenixFilter('direct')}
              >
                <span>Personal</span>
              </button>
              <button
                type="button"
                className={`phoenix-tab-pill ${phoenixFilter === 'groups' ? 'active' : ''}`}
                onClick={() => setPhoenixFilter('groups')}
              >
                <span>Groups</span>
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
          <div style={{ flex: 1, overflowY: 'auto', overflowX: 'hidden', padding: '0.2rem 0.75rem 0.75rem' }}>
            {loadingGroups ? (
              <div style={{ padding: '2.5rem 1rem', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.85rem' }}>
                <RefreshCw size={20} className="spin-loader" style={{ marginBottom: '0.5rem' }} />
                <div>Loading conversations...</div>
              </div>
            ) : filteredGroups.length === 0 ? (
              searchQuery.trim().length >= 2 && (messageSearchResults.length > 0 || isSearchingMessages) ? null : (
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
              )
            ) : (
              <>
                {searchQuery.trim().length >= 2 && filteredGroups.length > 0 && (
                  <div style={{ padding: '6px 8px 4px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <span style={{ fontSize: '0.72rem', fontWeight: 800, color: 'var(--text-muted, #64748b)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                      Contacts &amp; Channels ({filteredGroups.length})
                    </span>
                  </div>
                )}
                {filteredGroups.map((group) => {
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
                        width: 40,
                        height: 40,
                        minWidth: 40,
                        minHeight: 40,
                        maxWidth: 40,
                        maxHeight: 40,
                        borderRadius: '50%',
                        flexShrink: 0,
                        display: 'inline-flex',
                        alignItems: 'center',
                        justifyContent: 'center',
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
                      {isDirect && (() => {
                        const colleagueId = colleague?._id || colleague?.id;
                        const isOnline = colleagueId ? onlineUserIds.has(String(colleagueId)) : false;
                        return (
                          <span
                            className={`phoenix-online-dot ${isOnline ? 'is-online' : 'is-offline'}`}
                            style={{
                              background: isOnline ? '#22c55e' : '#94a3b8',
                              borderColor: 'var(--bg-card, #ffffff)'
                            }}
                            title={isOnline ? 'Online' : 'Offline'}
                          />
                        );
                      })()}
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
                          {group.lastMessage ? formatChatListTime(group.lastMessage.createdAt) : ''}
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
                            ? ((group.lastMessage.isDeleted || group.lastMessage.content === 'This message was deleted')
                                ? '🚫 This message was deleted'
                                : group.lastMessage.msgType === 'system_activity' ? '🤖 Activity Logged'
                                : group.lastMessage.attachment
                                  ? (group.lastMessage.attachment.fileType === 'image' || /\.(jpg|jpeg|png|webp|gif|svg)$/i.test(group.lastMessage.attachment.fileName || group.lastMessage.attachment.fileUrl || '')
                                      ? (group.lastMessage.content && !group.lastMessage.content.startsWith('Attached ') && group.lastMessage.content.toLowerCase() !== 'attached blob' ? `📷 ${group.lastMessage.content}` : '📷 Photo')
                                      : (group.lastMessage.content && !group.lastMessage.content.startsWith('Attached ') ? `📎 ${group.lastMessage.content}` : `📎 ${group.lastMessage.attachment.fileName || 'Attachment'}`))
                                  : group.lastMessage.content)
                            : (isVirtual ? 'Tap to start a new chat' : (isDirect ? 'Direct conversation' : (group.description || 'Channel conversation')))}
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
              })}
            </>
          )}

            {searchQuery.trim().length >= 2 && (
              <div style={{ marginTop: '0.85rem', borderTop: '1px solid var(--border-light, #e2e8f0)', paddingTop: '0.65rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 4px 6px' }}>
                  <span style={{ fontSize: '0.72rem', fontWeight: 800, color: 'var(--text-muted, #64748b)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                    Matching Messages ({messageSearchResults.length})
                  </span>
                  {isSearchingMessages && <RefreshCw size={12} className="spin-loader" color="#3874ff" />}
                </div>

                {messageSearchResults.length === 0 && !isSearchingMessages ? (
                  <div style={{ padding: '0.5rem', textAlign: 'center', fontSize: '0.76rem', color: 'var(--text-muted)' }}>
                    No messages matched "{searchQuery}"
                  </div>
                ) : (
                  messageSearchResults.map((m) => {
                    const rawRoomId = typeof m.roomId === 'object' ? (m.roomId?._id || m.roomId?.id) : (m.roomId || m.conversationId);
                    const roomName = typeof m.roomId === 'object' ? (m.roomId?.name || m.roomId?.title) : null;
                    const targetRoom = groups.find((g) => String(g._id) === String(rawRoomId));
                    return (
                      <div
                        key={m._id}
                        onClick={() => {
                          if (targetRoom) {
                            handleSelectGroup(targetRoom);
                          } else if (rawRoomId) {
                            handleSelectGroup({ _id: rawRoomId, name: roomName || 'Conversation', type: m.roomId?.type || 'group' });
                          }
                        }}
                        style={{
                          padding: '7px 10px',
                          borderRadius: '8px',
                          cursor: 'pointer',
                          background: 'var(--bg-card, #ffffff)',
                          marginBottom: '6px',
                          border: '1px solid var(--border-light, #e2e8f0)',
                          transition: 'background 0.15s ease'
                        }}
                        onMouseEnter={(e) => { e.currentTarget.style.background = '#f1f5f9'; }}
                        onMouseLeave={(e) => { e.currentTarget.style.background = 'var(--bg-card, #ffffff)'; }}
                      >
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', fontWeight: 700, color: '#2563eb' }}>
                          <span>{targetRoom?.name || roomName || 'Conversation'}</span>
                          <span style={{ color: 'var(--text-muted, #94a3b8)', fontWeight: 400, fontSize: '0.7rem' }}>
                            {formatTime(m.createdAt)}
                          </span>
                        </div>
                        <div style={{
                          fontSize: '0.78rem',
                          color: 'var(--text-primary, #1e293b)',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap',
                          marginTop: '2px'
                        }}>
                          {m.content || m.text}
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            )}
          </div>
        </div>

        {/* ════ RIGHT COLUMN: PHOENIX ACTIVE CHAT STREAM ════ */}
        <div
          className={`phoenix-chat-main ${(isMobileScreen && !activeGroup) ? 'is-mobile-hidden is-hidden' : ''}`}
          style={{ display: (isMobileScreen && !activeGroup) ? 'none' : 'flex', flexDirection: 'column', position: 'relative' }}
          onDragEnter={handleChatDragEnter}
          onDragOver={handleChatDragOver}
          onDragLeave={handleChatDragLeave}
          onDrop={handleChatDrop}
          onPaste={handlePasteClipboard}
        >
          
          {rosterTab === 'tasks' ? (
            <div style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>
              <TaskManagerPanel currentUser={currentUser} onNavigateTab={onNavigateTab} />
            </div>
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
                            onClick={() => {
                              setActiveGroup(null);
                              setShowMobileActionMenu(false);
                              setShowMobileHeaderMenu(false);
                              if (typeof window !== 'undefined' && window.history.state?.eliteChatRoom) {
                                window.history.back();
                              }
                            }}
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
                          {isDirect && (() => {
                            const colleagueId = colleague?._id || colleague?.id;
                            const isOnline = colleagueId ? onlineUserIds.has(String(colleagueId)) : false;
                            return (
                              <span
                                className={`phoenix-online-dot ${isOnline ? 'is-online' : 'is-offline'}`}
                                style={{
                                  background: isOnline ? '#22c55e' : '#94a3b8',
                                  borderColor: 'var(--bg-card, #ffffff)'
                                }}
                                title={isOnline ? 'Online' : 'Offline'}
                              />
                            );
                          })()}
                        </div>

                        {/* Name + Dropdown Chevron + Active Now Status */}
                        <div style={{ minWidth: 0, flex: '1 1 auto', overflow: 'hidden' }}>
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
                              textAlign: 'left',
                              width: '100%',
                              maxWidth: isMobileScreen ? '100%' : '380px',
                              minWidth: 0,
                              overflow: 'hidden'
                            }}
                            title="Click for conversation options"
                          >
                            <h3 style={{
                              margin: 0,
                              fontSize: isMobileScreen ? '0.96rem' : '1.05rem',
                              fontWeight: 800,
                              color: 'var(--text-primary)',
                              whiteSpace: 'nowrap',
                              overflow: 'hidden',
                              textOverflow: 'ellipsis',
                              flex: '1 1 auto',
                              minWidth: 0
                            }}>
                              {displayName}
                            </h3>
                            <ChevronDown size={15} color="var(--text-muted)" style={{ flexShrink: 0 }} />
                          </button>

                          {(() => {
                            const colleagueId = colleague?._id || colleague?.id;
                            const isOnline = isDirect && colleagueId ? onlineUserIds.has(String(colleagueId)) : false;
                            if (isDirect) {
                              return (
                                <div style={{ display: 'flex', alignItems: 'center', gap: '5px', marginTop: '2px', maxWidth: isMobileScreen ? '100%' : '380px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                  <span style={{ width: 7, height: 7, borderRadius: '50%', background: isOnline ? '#22c55e' : '#94a3b8', display: 'inline-block', flexShrink: 0 }} />
                                  <span style={{ fontSize: '0.72rem', color: isOnline ? '#10b981' : 'var(--text-muted, #64748b)', fontWeight: 600 }}>
                                    {isOnline ? 'Online' : 'Offline'}
                                  </span>
                                </div>
                              );
                            }
                            return (
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleOpenMembers();
                                }}
                                style={{
                                  background: 'none',
                                  border: 'none',
                                  padding: 0,
                                  cursor: 'pointer',
                                  display: 'flex',
                                  alignItems: 'center',
                                  gap: '5px',
                                  marginTop: '2px',
                                  maxWidth: isMobileScreen ? '100%' : '380px',
                                  overflow: 'hidden',
                                  textOverflow: 'ellipsis',
                                  whiteSpace: 'nowrap'
                                }}
                                title="Click to view group members"
                              >
                                <Users size={12} color="#2563eb" style={{ flexShrink: 0 }} />
                                <span style={{ fontSize: '0.72rem', color: '#2563eb', fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                  Group • {activeGroup?.members?.length || 0} members
                                </span>
                              </button>
                            );
                          })()}
                        </div>
                      </div>

                      {/* Right: Media Folder, Phone, Video, and More Options Buttons (Phoenix 1:1) */}
                      <div style={{ display: 'flex', alignItems: 'center', gap: isMobileScreen ? '6px' : '8px', flexShrink: 0 }}>
                        {!isMobileScreen && (
                          <>
                            {/* Shared Media & Docs Drawer Button */}
                            <button
                              type="button"
                              className="phoenix-action-btn-neutral"
                              style={{ width: 36, height: 36 }}
                              onClick={() => setShowGalleryModal(true)}
                              title="Shared Media, Docs & Files"
                            >
                              <Folder size={16} color="var(--text-primary)" />
                            </button>
                            {/* Phone Call Button */}
                            <button
                              type="button"
                              className="phoenix-action-btn-blue"
                              style={{ width: 36, height: 36 }}
                              onClick={() => startCall('voice')}
                              title="Start HD Voice Call"
                            >
                              <Phone size={16} />
                            </button>

                            {/* Video Call Button */}
                            <button
                              type="button"
                              className="phoenix-action-btn-blue"
                              style={{ width: 36, height: 36 }}
                              onClick={() => startCall('video')}
                              title="Start HD Video Call"
                            >
                              <Video size={16} />
                            </button>
                          </>
                        )}

                        {/* ERP Operations Copilot Quick Trigger */}
                        <button
                          type="button"
                          className="phoenix-action-btn-neutral"
                          style={{
                            width: isMobileScreen ? 32 : 36,
                            height: isMobileScreen ? 32 : 36,
                            color: '#2563eb',
                            background: 'rgba(37,99,235,0.08)',
                            border: '1px solid rgba(37,99,235,0.2)'
                          }}
                          onClick={() => setShowCopilotModal(true)}
                          title="Open ERP Operations Copilot"
                        >
                          <Zap size={isMobileScreen ? 14 : 16} />
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

              {/* Messages & Activity Stream Container Wrapper */}
              <div style={{ position: 'relative', flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column' }}>
                {/* Floating Loading Indicator Outside List Content Flow (Prevents 36px jump) */}
                {loadingMoreMessages && (
                  <div
                    style={{
                      position: 'absolute',
                      top: 10,
                      left: '50%',
                      transform: 'translateX(-50%)',
                      zIndex: 35,
                      pointerEvents: 'none',
                      background: 'rgba(255, 255, 255, 0.96)',
                      backdropFilter: 'blur(8px)',
                      border: '1px solid var(--border-light, #cbd5e1)',
                      borderRadius: '20px',
                      padding: '5px 16px',
                      boxShadow: '0 4px 16px rgba(0,0,0,0.12)',
                      color: 'var(--text-primary, #0f172a)',
                      fontSize: '0.75rem',
                      fontWeight: 700,
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px',
                      animation: 'fadeIn 0.15s ease'
                    }}
                  >
                    <RefreshCw size={13} className="spin-loader" color="#2563eb" />
                    <span>Loading older messages...</span>
                  </div>
                )}

                {/* Messages & Activity Stream Container */}
                <div
                  ref={chatScrollRef}
                  onScroll={handleChatScroll}
                  onClick={() => setActiveMsgMenuId(null)}
                  onDragEnter={handleChatDragEnter}
                  onDragOver={handleChatDragOver}
                  onDragLeave={handleChatDragLeave}
                  onDrop={handleChatDrop}
                  onPaste={handlePasteClipboard}
                  className="phoenix-chat-stream"
                  style={{ flex: 1, minHeight: 0, overflowY: 'auto', overflowX: 'hidden', padding: '0.75rem 1rem', display: 'flex', flexDirection: 'column', gap: '4px', position: 'relative' }}
                >
                  {/* Drag and Drop Visual Dropzone Overlay */}
                  {isChatDragging && (
                    <div style={{
                      position: 'absolute',
                      inset: '8px',
                      background: 'rgba(37, 99, 235, 0.12)',
                      border: '2px dashed #2563eb',
                      borderRadius: '12px',
                      backdropFilter: 'blur(3px)',
                      zIndex: 50,
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '10px',
                      pointerEvents: 'none'
                    }}>
                      <div style={{ width: 48, height: 48, borderRadius: '50%', background: '#2563eb', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', boxShadow: '0 4px 12px rgba(37,99,235,0.3)' }}>
                        <Paperclip size={24} />
                      </div>
                      <div style={{ fontSize: '0.95rem', fontWeight: 800, color: '#1e40af' }}>Drop file here to attach</div>
                      <div style={{ fontSize: '0.75rem', color: '#3b82f6', fontWeight: 600 }}>PDFs, Screenshots, Images, Excel, Word & Audio files supported</div>
                    </div>
                  )}

                {!hasMoreMessages && messages.length > 0 && !loadingMessages && (
                  <div style={{
                    textAlign: 'center',
                    padding: '1.25rem 0.5rem 0.65rem',
                    color: 'var(--text-muted, #94a3b8)',
                    fontSize: '0.72rem',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '8px'
                  }}>
                    <span style={{ height: '1px', background: 'var(--border-light, #e2e8f0)', width: '40px' }} />
                    <span style={{ fontWeight: 600 }}>Start of conversation</span>
                    <span style={{ height: '1px', background: 'var(--border-light, #e2e8f0)', width: '40px' }} />
                  </div>
                )}

                <ErrorBoundary fallback={<div style={{ padding: '1rem', color: '#dc2626', textAlign: 'center' }}>Unable to display messages. Please refresh.</div>}>
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

                  if (streamHistoryError) {
                    return (
                      <div style={{ margin: 'auto', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.85rem', padding: '1.5rem' }}>
                        <AlertCircle size={28} color="#ef4444" style={{ marginBottom: '0.5rem' }} />
                        <div style={{ fontWeight: 600, color: '#ef4444', marginBottom: '0.6rem' }}>{streamHistoryError}</div>
                        <button
                          type="button"
                          onClick={() => {
                            setStreamHistoryError(null);
                            if (activeGroup?._id) fetchGroupMessages(activeGroup._id, msgFilter, true);
                          }}
                          style={{
                            padding: '6px 14px',
                            background: '#2563eb',
                            color: '#fff',
                            border: 'none',
                            borderRadius: '6px',
                            fontSize: '0.8rem',
                            fontWeight: 600,
                            cursor: 'pointer'
                          }}
                        >
                          Retry
                        </button>
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

                  const sortedList = [...filteredList].sort((a, b) => new Date(a.createdAt || 0) - new Date(b.createdAt || 0));

                  // Group messages by day for native WhatsApp/iOS floating sticky date headers
                  const dayGroups = [];
                  let curGroup = null;

                  sortedList.forEach((msg) => {
                    const dateHeader = formatMessageDateHeader(msg.createdAt);
                    if (!curGroup || curGroup.dateHeader !== dateHeader) {
                      curGroup = {
                        dateHeader,
                        key: `day_${dateHeader}_${msg._id}`,
                        messages: []
                      };
                      dayGroups.push(curGroup);
                    }
                    curGroup.messages.push(msg);
                  });

                  return dayGroups.map((group) => (
                    <div
                      key={group.key}
                      className="phoenix-day-group"
                      style={{
                        position: 'relative',
                        width: '100%',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '4px'
                      }}
                    >
                      {/* WhatsApp / Telegram Floating Sticky Date Header (constrained by parent day group) */}
                      <div
                        className="phoenix-sticky-date-wrapper"
                        style={{
                          position: 'sticky',
                          top: 4,
                          zIndex: 10,
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          alignSelf: 'center',
                          textAlign: 'center',
                          padding: '6px 0',
                          pointerEvents: 'none',
                          width: '100%',
                          maxWidth: '100%',
                          left: 0,
                          right: 0,
                          margin: '0 auto'
                        }}
                      >
                        <span className="phoenix-date-badge" style={{ margin: '0 auto', textAlign: 'center' }}>
                          {group.dateHeader}
                        </span>
                      </div>

                      {group.messages.map((msg, msgIndex) => {
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

                    const isAudioMsg = msg.type === 'audio-voice' || (msg.attachment && msg.attachment.fileType === 'audio');
                    const isRecordCard = msg.type === 'record-card' || Boolean(msg.activityMeta && msg.activityMeta.module);
                    const isPollMsg = msg.type === 'poll' || Boolean(msg.pollMeta && msg.pollMeta.question);
                    const isCallLog = msg.type === 'call-log' || Boolean(msg.activityMeta && msg.activityMeta.callType);

                    const rawAttName = msg.attachment?.fileName || (typeof msg.attachment?.fileUrl === 'string' ? msg.attachment.fileUrl.split('/').pop().split('?')[0] : '');
                    const isImageAttachment = Boolean(msg.attachment && msg.attachment.fileUrl && !isAudioMsg && (
                      msg.attachment.fileType === 'image' || /\.(jpg|jpeg|png|webp|gif|svg|bmp)$/i.test(rawAttName.toLowerCase())
                    ));
                    const isAutoAttachmentText = Boolean(
                      msg.attachment &&
                      typeof msg.content === 'string' &&
                      (!msg.content.trim() ||
                        /^Attached\s+/i.test(msg.content.trim()) ||
                        msg.content.trim().toLowerCase() === 'attached blob' ||
                        msg.content.trim().toLowerCase() === 'attached image' ||
                        msg.content.trim().toLowerCase() === 'attached file' ||
                        (msg.attachment.fileName && msg.content.trim() === msg.attachment.fileName))
                    );
                    const hasVisibleContent = Boolean(
                      typeof msg.content === 'string' && msg.content.trim() && (!msg.attachment || !isAutoAttachmentText)
                    );
                    const isImageOnly = isImageAttachment && !hasVisibleContent && !msg.replyTo && !isRecordCard && !isPollMsg && !isCallLog;

                    const isAdmin = currentUser?.role === 'admin' || currentUser?.role === 'superadmin' || currentUser?.isAdmin;
                    const senderIdStr = String(typeof msg.senderId === 'object' ? (msg.senderId?._id || msg.senderId?.id) : (msg.senderId || ''));
                    const myIdStr = String(currentUser?._id || currentUser?.id || '');
                    const isSender = senderIdStr === myIdStr;
                    const isWithin24h = (Date.now() - new Date(msg.createdAt || Date.now()).getTime()) < 24 * 60 * 60 * 1000;
                    const canDelete = !msg.isDeleted && (isAdmin || (isSender && isWithin24h));

                    return (
                      <div
                        key={msg._id}
                        id={`msg_${msg._id}`}
                        data-msg-id={msg._id}
                        onTouchStart={(e) => {
                            if (isMobileScreen) {
                              touchStartXRef.current = e.touches[0].clientX;
                            }
                          }}
                          onTouchEnd={(e) => {
                            if (isMobileScreen && touchStartXRef.current !== null) {
                              const diff = e.changedTouches[0].clientX - touchStartXRef.current;
                              touchStartXRef.current = null;
                              if (diff > 60) {
                                setReplyToMessage(msg);
                                if (navigator.vibrate) navigator.vibrate(30);
                              }
                            }
                          }}
                          style={{
                            display: 'flex',
                            alignItems: 'flex-end',
                            gap: '8px',
                            alignSelf: isMe ? 'flex-end' : 'flex-start',
                            maxWidth: isMobileScreen ? '88%' : '75%',
                            minWidth: 0,
                            boxSizing: 'border-box',
                            marginBottom: '6px',
                            position: 'relative',
                            zIndex: activeMsgMenuId === msg._id ? 100 : 1
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
                              maxWidth: '100%',
                              boxSizing: 'border-box',
                              flex: 1
                            }}
                          >
                            <div
                              className={isMe ? 'phoenix-bubble-sent' : 'phoenix-bubble-received'}
                              onMouseDown={() => handleStartMsgHold(msg._id)}
                              onMouseUp={handleCancelMsgHold}
                              onMouseLeave={handleCancelMsgHold}
                              onTouchStart={() => handleStartMsgHold(msg._id)}
                              onTouchEnd={handleCancelMsgHold}
                              onTouchCancel={handleCancelMsgHold}
                              onContextMenu={(e) => handleOpenMsgMenu(e, msg._id)}
                              style={{
                                background: msg.priority === 'urgent'
                                  ? (isMe ? 'linear-gradient(135deg, #ef4444 0%, #b91c1c 100%)' : '#fee2e2')
                                  : (isMe ? '#3874ff' : 'var(--bg-card, #ffffff)'),
                                color: msg.priority === 'urgent'
                                  ? (isMe ? '#ffffff' : '#991b1b')
                                  : (isMe ? '#ffffff' : 'var(--text-primary, #141824)'),
                                padding: isImageOnly ? '4px' : (isImageAttachment ? '4px 4px 8px 4px' : '10px 14px'),
                                borderRadius: isImageOnly ? '10px' : '12px',
                                border: msg.priority === 'urgent'
                                  ? (isMe ? '1.5px solid #fca5a5' : '1.5px solid #ef4444')
                                  : (isMe ? 'none' : '1px solid var(--border-light, #e3e6ed)'),
                                boxShadow: msg.priority === 'urgent'
                                  ? '0 3px 12px rgba(239,68,68,0.25)'
                                  : (isMe ? '0 2px 8px rgba(56, 116, 255, 0.2)' : '0 1px 2px rgba(0,0,0,0.03)'),
                                fontSize: '0.88rem',
                                lineHeight: 1.5,
                                wordBreak: 'break-word',
                                overflowWrap: 'anywhere',
                                whiteSpace: 'pre-wrap',
                                maxWidth: '100%',
                                boxSizing: 'border-box',
                                position: 'relative',
                                minWidth: isImageOnly ? '160px' : '75px'
                              }}
                            >
                            {/* WhatsApp Down-Chevron Trigger */}
                            {!msg.isDeleted && (
                              <button
                                type="button"
                                className="wa-bubble-trigger"
                                onClick={(e) => handleOpenMsgMenu(e, msg._id)}
                                style={{
                                  position: 'absolute',
                                  top: isImageOnly ? '8px' : '3px',
                                  right: isImageOnly ? '8px' : '3px',
                                  background: isImageOnly ? 'rgba(0, 0, 0, 0.45)' : (isMe ? 'rgba(255, 255, 255, 0.25)' : 'rgba(241, 245, 249, 0.95)'),
                                  border: 'none',
                                  borderRadius: '50%',
                                  width: '20px',
                                  height: '20px',
                                  display: 'flex',
                                  alignItems: 'center',
                                  justifyContent: 'center',
                                  cursor: 'pointer',
                                  color: (isImageOnly || isMe) ? '#ffffff' : '#64748b',
                                  boxShadow: '0 1px 3px rgba(0,0,0,0.2)',
                                  zIndex: 4
                                }}
                                title="Message options"
                              >
                                <ChevronDown size={12} />
                              </button>
                            )}

                            {/* 3-Second Hold / Options Popup Menu */}
                            {!msg.isDeleted && activeMsgMenuId === msg._id && (() => {
                              const isUpward = msgMenuUpward[msg._id] !== undefined
                                ? msgMenuUpward[msg._id]
                                : (msgIndex >= Math.max(0, filteredList.length - 6));
                              return (
                                <>
                                  <div
                                    style={{ position: 'fixed', inset: 0, zIndex: 9998 }}
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      setActiveMsgMenuId(null);
                                    }}
                                  />
                                  <div
                                    style={{
                                      position: 'absolute',
                                      top: isUpward ? 'auto' : '24px',
                                      bottom: isUpward ? 'calc(100% + 4px)' : 'auto',
                                      marginBottom: isUpward ? '4px' : 0,
                                      right: isMe ? 0 : 'auto',
                                      left: isMe ? 'auto' : 0,
                                      background: '#ffffff',
                                      borderRadius: '10px',
                                      boxShadow: '0 12px 35px rgba(0,0,0,0.25)',
                                      zIndex: 99999,
                                      minWidth: '190px',
                                      maxHeight: 'min(380px, 85vh)',
                                      overflowY: 'auto',
                                      padding: '6px 0',
                                      border: '1.5px solid #bfdbfe',
                                      animation: 'fadeIn 0.15s ease'
                                    }}
                                    onClick={(e) => e.stopPropagation()}
                                  >

                                  {(msg.isOptimistic || String(msg._id).startsWith('temp_') || msg.sendFailed) ? (
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '2px', padding: '4px' }}>
                                      {msg.sendFailed && (
                                        <button
                                          type="button"
                                          onClick={() => {
                                            setActiveMsgMenuId(null);
                                            handleRetryFailedMessage(msg);
                                          }}
                                          style={{ width: '100%', display: 'flex', alignItems: 'center', gap: '8px', padding: '8px 12px', background: 'none', border: 'none', fontSize: '0.8rem', color: '#2563eb', cursor: 'pointer', textAlign: 'left', fontWeight: 600 }}
                                        >
                                          <RefreshCw size={14} color="#2563eb" />
                                          <span>Retry Send</span>
                                        </button>
                                      )}
                                      <button
                                        type="button"
                                        onClick={(e) => {
                                          if (e) e.stopPropagation();
                                          handleCancelMsgHold();
                                          setActiveMsgMenuId(null);
                                          setMessages((prev) => prev.filter((m) => m._id !== msg._id && m.clientMsgId !== msg.clientMsgId));
                                        }}
                                        style={{ width: '100%', display: 'flex', alignItems: 'center', gap: '8px', padding: '8px 12px', background: 'none', border: 'none', fontSize: '0.8rem', color: '#dc2626', cursor: 'pointer', textAlign: 'left', fontWeight: 600 }}
                                      >
                                        <Trash2 size={14} color="#dc2626" />
                                        <span>Remove Unsent Message</span>
                                      </button>
                                    </div>
                                  ) : (
                                    <>
                                  {/* Quick Reactions Bar */}
                                  <div style={{ display: 'flex', justifyContent: 'space-around', padding: '6px 8px', borderBottom: '1px solid #f1f5f9' }}>
                                    {['👍', '❤️', '😂', '😮', '😢', '🙏', '👏', '🔥'].map((emo) => (
                                      <button
                                        key={emo}
                                        type="button"
                                        onClick={() => {
                                          handleToggleReaction(msg._id, emo);
                                          setActiveMsgMenuId(null);
                                        }}
                                        style={{ background: 'none', border: 'none', fontSize: '1.15rem', cursor: 'pointer', padding: '2px', transition: 'transform 0.1s' }}
                                        title={`React ${emo}`}
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

                                  {isSender && !msg.isDeleted && !isPollMsg && !isCallLog && (
                                    <button
                                      type="button"
                                      onClick={() => {
                                        setActiveMsgMenuId(null);
                                        setEditingMessage(msg);
                                        setInputMessage(msg.content || '');
                                        if (chatTextareaRef.current) {
                                          chatTextareaRef.current.focus();
                                        }
                                      }}
                                      style={{ width: '100%', display: 'flex', alignItems: 'center', gap: '8px', padding: '7px 12px', background: 'none', border: 'none', fontSize: '0.8rem', color: '#1e293b', cursor: 'pointer', textAlign: 'left' }}
                                    >
                                      <Edit3 size={14} color="#0284c7" />
                                      <span>Edit Message</span>
                                    </button>
                                  )}

                                  {msg.content && (
                                    <button
                                      type="button"
                                      onClick={() => {
                                        if (navigator.clipboard) {
                                          navigator.clipboard.writeText(msg.content);
                                        }
                                        setActiveMsgMenuId(null);
                                      }}
                                      style={{ width: '100%', display: 'flex', alignItems: 'center', gap: '8px', padding: '7px 12px', background: 'none', border: 'none', fontSize: '0.8rem', color: '#1e293b', cursor: 'pointer', textAlign: 'left' }}
                                    >
                                      <span>📋</span>
                                      <span>Copy Text</span>
                                    </button>
                                  )}

                                  {canDelete && (
                                    <button
                                      type="button"
                                      onClick={(e) => {
                                        if (e) e.stopPropagation();
                                        handleCancelMsgHold();
                                        setActiveMsgMenuId(null);
                                        handleDeleteMessage(msg);
                                      }}
                                      style={{ width: '100%', display: 'flex', alignItems: 'center', gap: '8px', padding: '7px 12px', background: 'none', border: 'none', borderTop: '1px solid #fee2e2', fontSize: '0.8rem', color: '#dc2626', cursor: 'pointer', textAlign: 'left', fontWeight: 600 }}
                                    >
                                      <Trash2 size={14} color="#dc2626" />
                                      <span>Delete Message</span>
                                    </button>
                                  )}
                                    </>
                                  )}
                                </div>
                              </>
                            );
                          })()}

                            {/* Bubble Content */}
                            {msg.isDeleted ? (
                              <div
                                style={{
                                  display: 'flex',
                                  alignItems: 'center',
                                  gap: '6px',
                                  fontStyle: 'italic',
                                  color: isMe ? 'rgba(255,255,255,0.8)' : '#64748b',
                                  fontSize: '0.84rem',
                                  padding: '2px 0',
                                  userSelect: 'none'
                                }}
                              >
                                <span style={{ fontSize: '0.9rem' }}>🚫</span>
                                <span>This message was deleted</span>
                              </div>
                            ) : (
                              <>
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

                            {/* Quoted Reply Card (Click to jump) */}
                            {msg.replyTo && (
                              <div
                                onClick={() => {
                                  const targetId = msg.replyTo?._id || msg.replyTo?.id || (typeof msg.replyTo === 'string' ? msg.replyTo : null);
                                  if (targetId) {
                                    const el = document.getElementById(`msg_${targetId}`);
                                    if (el) {
                                      el.scrollIntoView({ behavior: 'smooth', block: 'center' });
                                      el.classList.remove('reply-jump-pulse');
                                      void el.offsetWidth; // Force CSS reflow to re-trigger animation
                                      el.classList.add('reply-jump-pulse');
                                      setTimeout(() => {
                                        el.classList.remove('reply-jump-pulse');
                                      }, 1700);
                                    }
                                  }
                                }}
                                style={{
                                  cursor: 'pointer',
                                  background: isMe ? 'rgba(255,255,255,0.15)' : 'rgba(37,99,235,0.06)',
                                  borderRadius: '5px',
                                  borderLeft: isMe ? '3.5px solid #ffffff' : '3.5px solid #2563eb',
                                  padding: '4px 8px',
                                  marginBottom: '6px',
                                  fontSize: '0.74rem',
                                  maxWidth: '100%',
                                  width: '100%',
                                  minWidth: 0,
                                  boxSizing: 'border-box',
                                  overflow: 'hidden'
                                }}
                                title="Click to jump to replied message"
                              >
                                <div style={{ fontWeight: 700, color: isMe ? '#ffffff' : '#2563eb', fontSize: '0.7rem', marginBottom: '2px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '100%' }}>
                                  {typeof msg.replyTo.senderId === 'object' ? (msg.replyTo.senderId.name || msg.replyTo.senderId.username) : 'Staff Member'}
                                </div>
                                <div style={{
                                  color: isMe ? 'rgba(255,255,255,0.92)' : '#475569',
                                  fontSize: '0.72rem',
                                  lineHeight: '1.35',
                                  maxWidth: '100%',
                                  minWidth: 0,
                                  wordBreak: 'break-word',
                                  overflowWrap: 'anywhere',
                                  whiteSpace: 'pre-wrap',
                                  display: '-webkit-box',
                                  WebkitLineClamp: 2,
                                  WebkitBoxOrient: 'vertical',
                                  overflow: 'hidden',
                                  textOverflow: 'ellipsis'
                                }}>
                                  {typeof msg.replyTo === 'object' ? (msg.replyTo.content || (msg.replyTo.attachment ? '📎 Attachment' : '')) : ''}
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

                            {/* Missed Call Log Card */}
                            {isCallLog && (
                              <div style={{
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'space-between',
                                gap: '12px',
                                padding: '0.55rem 0.85rem',
                                background: isMe ? 'rgba(255,255,255,0.18)' : '#fff1f2',
                                border: isMe ? '1px solid rgba(255,255,255,0.25)' : '1px solid #fecdd3',
                                borderRadius: '10px',
                                marginBottom: '0.35rem',
                                minWidth: 210
                              }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                  <div style={{
                                    width: 32,
                                    height: 32,
                                    borderRadius: '50%',
                                    background: isMe ? 'rgba(255,255,255,0.2)' : '#fee2e2',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    color: isMe ? '#ffffff' : '#e11d48'
                                  }}>
                                    {msg.activityMeta?.callType === 'video' ? <Video size={16} /> : <PhoneMissed size={16} />}
                                  </div>
                                  <div>
                                    <div style={{ fontSize: '0.82rem', fontWeight: 800, color: isMe ? '#ffffff' : '#9f1239' }}>
                                      {msg.content || `Missed ${msg.activityMeta?.callType || 'voice'} call`}
                                    </div>
                                    <div style={{ fontSize: '0.68rem', color: isMe ? 'rgba(255,255,255,0.85)' : '#be123c' }}>
                                      {formatTime(msg.createdAt)}
                                    </div>
                                  </div>
                                </div>

                                {!isMe && (
                                  <button
                                    type="button"
                                    onClick={() => startCall(msg.activityMeta?.callType || 'voice')}
                                    style={{
                                      display: 'flex',
                                      alignItems: 'center',
                                      gap: '4px',
                                      background: '#e11d48',
                                      color: '#ffffff',
                                      border: 'none',
                                      padding: '4px 10px',
                                      borderRadius: '6px',
                                      fontSize: '0.72rem',
                                      fontWeight: 800,
                                      cursor: 'pointer',
                                      boxShadow: '0 2px 5px rgba(225,29,72,0.25)'
                                    }}
                                    title="Call back immediately"
                                  >
                                    <PhoneCall size={12} />
                                    <span>Call Back</span>
                                  </button>
                                )}
                              </div>
                            )}

                            {/* Audio Voice Player Card (With Scrubber & Speed Control) */}
                            {isAudioMsg && msg.attachment && msg.attachment.fileUrl && (
                              <div style={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: '0.75rem',
                                padding: '0.5rem 0.75rem',
                                background: isMe ? 'rgba(255,255,255,0.18)' : 'rgba(37,99,235,0.06)',
                                borderRadius: '12px',
                                marginBottom: '0.35rem',
                                minWidth: 220,
                                maxWidth: 290
                              }}>
                                <button
                                  type="button"
                                  onClick={() => handlePlayVoiceNote(msg._id, msg.attachment.fileUrl)}
                                  style={{
                                    background: isMe ? '#ffffff' : '#2563eb',
                                    color: isMe ? '#2563eb' : '#ffffff',
                                    border: 'none',
                                    width: 34,
                                    height: 34,
                                    borderRadius: '50%',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    cursor: 'pointer',
                                    flexShrink: 0,
                                    boxShadow: '0 2px 6px rgba(0,0,0,0.15)'
                                  }}
                                  title={playingAudioId === msg._id && isAudioPlaying ? 'Pause' : 'Play'}
                                >
                                  {playingAudioId === msg._id && isAudioPlaying ? <Pause size={16} /> : <Play size={16} />}
                                </button>

                                <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: '3px' }}>
                                  <div
                                    onClick={(e) => handleAudioSeek(e, msg._id, msg.attachment.durationSec)}
                                    style={{
                                      width: '100%',
                                      height: 6,
                                      background: isMe ? 'rgba(255,255,255,0.3)' : 'rgba(37,99,235,0.2)',
                                      borderRadius: 3,
                                      cursor: 'pointer',
                                      position: 'relative',
                                      overflow: 'hidden'
                                    }}
                                    title="Seek audio position"
                                  >
                                    <div
                                      style={{
                                        height: '100%',
                                        width: `${playingAudioId === msg._id ? audioProgress : 0}%`,
                                        background: isMe ? '#ffffff' : '#2563eb',
                                        borderRadius: 3,
                                        transition: 'width 0.1s linear'
                                      }}
                                    />
                                  </div>

                                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: '0.68rem', color: isMe ? 'rgba(255,255,255,0.9)' : '#64748b' }}>
                                    <span>
                                      {playingAudioId === msg._id
                                        ? `${Math.floor(audioCurrentTime / 60)}:${String(Math.floor(audioCurrentTime % 60)).padStart(2, '0')}`
                                        : (msg.attachment.durationSec ? `${Math.floor(msg.attachment.durationSec / 60)}:${String(Math.floor(msg.attachment.durationSec % 60)).padStart(2, '0')}` : 'Voice Note')}
                                    </span>
                                    <button
                                      type="button"
                                      onClick={handleToggleAudioSpeed}
                                      style={{
                                        background: isMe ? 'rgba(255,255,255,0.25)' : 'rgba(37,99,235,0.12)',
                                        color: isMe ? '#ffffff' : '#2563eb',
                                        border: 'none',
                                        borderRadius: '4px',
                                        fontSize: '0.65rem',
                                        fontWeight: 800,
                                        padding: '1px 5px',
                                        cursor: 'pointer'
                                      }}
                                      title="Playback speed"
                                    >
                                      {playbackSpeed}x
                                    </button>
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

                            {/* Attachment: Image, PDF, Spreadsheet or Document */}
                            {msg.attachment && msg.attachment.fileUrl && !isAudioMsg && (
                              <div style={{ marginBottom: hasVisibleContent ? '0.4rem' : 0 }}>
                                {(() => {
                                  const rawName = msg.attachment.fileName || msg.attachment.originalName || (typeof msg.attachment.fileUrl === 'string' ? decodeURIComponent(msg.attachment.fileUrl.split('/').pop().split('?')[0]) : 'Attachment');
                                  let fileNameDisplay = rawName;
                                  if (!fileNameDisplay || fileNameDisplay.toLowerCase() === 'blob' || fileNameDisplay.toLowerCase() === 'blob.blob' || fileNameDisplay.startsWith('blob:') || fileNameDisplay.toLowerCase() === 'image') {
                                    const fromUrl = typeof msg.attachment.fileUrl === 'string' ? decodeURIComponent(msg.attachment.fileUrl.split('/').pop().split('?')[0]) : '';
                                    fileNameDisplay = (fromUrl && !fromUrl.startsWith('blob')) ? fromUrl : 'Attachment';
                                  }
                                  const lowerName = fileNameDisplay.toLowerCase();
                                  const isImg = msg.attachment.fileType === 'image' || /\.(jpg|jpeg|png|webp|gif|svg|bmp)$/i.test(lowerName);
                                  const isPdf = msg.attachment.fileType === 'pdf' || lowerName.endsWith('.pdf') || msg.attachment.mimeType === 'application/pdf';
                                  const isSheet = msg.attachment.fileType === 'spreadsheet' || /\.(xls|xlsx|csv)$/i.test(lowerName);

                                  if (isImg) {
                                    return (
                                      <div
                                        style={{
                                          position: 'relative',
                                          borderRadius: '8px',
                                          overflow: 'hidden',
                                          cursor: 'zoom-in',
                                          lineHeight: 0
                                        }}
                                        onClick={() => {
                                          setViewerZoom(1);
                                          setViewerRotation(0);
                                          setAttachmentViewer({
                                            url: msg.attachment.fileUrl,
                                            fileName: fileNameDisplay,
                                            fileType: 'image',
                                            fileSize: msg.attachment.fileSize,
                                            senderName: msg.senderId?.name || msg.senderName,
                                            createdAt: msg.createdAt
                                          });
                                        }}
                                        title="Click to view full image"
                                      >
                                        <img
                                          src={msg.attachment.fileUrl}
                                          alt={fileNameDisplay}
                                          style={{
                                            width: '100%',
                                            maxWidth: '380px',
                                            maxHeight: '340px',
                                            borderRadius: '8px',
                                            cursor: 'zoom-in',
                                            objectFit: 'cover',
                                            display: 'block'
                                          }}
                                        />
                                      </div>
                                    );
                                  }

                                  // Dedicated PDF, Spreadsheet, or Document Card (WhatsApp style)
                                  return (
                                    <div
                                      onClick={() => setAttachmentViewer({
                                        url: msg.attachment.fileUrl,
                                        fileName: fileNameDisplay,
                                        fileType: isPdf ? 'pdf' : (isSheet ? 'spreadsheet' : 'document'),
                                        fileSize: msg.attachment.fileSize,
                                        senderName: msg.senderId?.name || msg.senderName,
                                        createdAt: msg.createdAt
                                      })}
                                      style={{
                                        background: isMe ? 'rgba(255, 255, 255, 0.18)' : 'var(--bg-card, #ffffff)',
                                        border: isMe ? '1px solid rgba(255, 255, 255, 0.3)' : '1px solid var(--border-light, #cbd5e1)',
                                        borderRadius: '10px',
                                        padding: '0.65rem 0.85rem',
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: '10px',
                                        minWidth: '220px',
                                        maxWidth: '340px',
                                        cursor: 'pointer',
                                        boxShadow: '0 1px 4px rgba(0,0,0,0.04)',
                                        transition: 'all 0.15s ease'
                                      }}
                                      title="Click to open preview"
                                    >
                                      <div
                                        style={{
                                          width: 38,
                                          height: 38,
                                          borderRadius: '8px',
                                          background: isPdf ? '#ef4444' : isSheet ? '#10b981' : '#3b82f6',
                                          color: '#ffffff',
                                          display: 'flex',
                                          flexDirection: 'column',
                                          alignItems: 'center',
                                          justifyContent: 'center',
                                          fontWeight: 900,
                                          fontSize: '0.62rem',
                                          flexShrink: 0
                                        }}
                                      >
                                        {isPdf ? (
                                          <>
                                            <FileText size={16} />
                                            <span style={{ fontSize: '0.55rem', lineHeight: 1 }}>PDF</span>
                                          </>
                                        ) : isSheet ? (
                                          <>
                                            <FileSpreadsheet size={16} />
                                            <span style={{ fontSize: '0.55rem', lineHeight: 1 }}>XLS</span>
                                          </>
                                        ) : (
                                          <>
                                            <Paperclip size={16} />
                                            <span style={{ fontSize: '0.55rem', lineHeight: 1 }}>DOC</span>
                                          </>
                                        )}
                                      </div>

                                      <div style={{ minWidth: 0, flex: 1 }}>
                                        <div
                                          style={{
                                            fontWeight: 700,
                                            fontSize: '0.84rem',
                                            color: 'inherit',
                                            whiteSpace: 'nowrap',
                                            overflow: 'hidden',
                                            textOverflow: 'ellipsis'
                                          }}
                                          title={fileNameDisplay}
                                        >
                                          {fileNameDisplay}
                                        </div>
                                        <div style={{ fontSize: '0.7rem', opacity: 0.8, marginTop: '2px' }}>
                                          {isPdf ? 'PDF' : isSheet ? 'Spreadsheet' : 'Document'}{msg.attachment.fileSize ? ` • ${formatFileSize(msg.attachment.fileSize)}` : ''}
                                        </div>
                                      </div>

                                      <button
                                        type="button"
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          handleDownloadAttachment(msg.attachment.fileUrl, fileNameDisplay);
                                        }}
                                        style={{
                                          width: 32,
                                          height: 32,
                                          borderRadius: '50%',
                                          background: isMe ? 'rgba(255,255,255,0.2)' : 'rgba(37,99,235,0.1)',
                                          color: isMe ? '#ffffff' : '#2563eb',
                                          display: 'flex',
                                          alignItems: 'center',
                                          justifyContent: 'center',
                                          textDecoration: 'none',
                                          flexShrink: 0,
                                          border: 'none',
                                          cursor: 'pointer'
                                        }}
                                        title={`Download ${fileNameDisplay}`}
                                      >
                                        <Download size={15} />
                                      </button>
                                    </div>
                                  );
                                })()}
                              </div>
                            )}

                            {/* Text Content / Caption (only if legitimate text exists) */}
                            {hasVisibleContent && (
                              <div style={{
                                fontSize: '0.88rem',
                                lineHeight: '1.42',
                                color: 'inherit',
                                whiteSpace: 'pre-wrap',
                                wordBreak: 'break-word',
                                overflowWrap: 'anywhere',
                                maxWidth: '100%',
                                minWidth: 0,
                                padding: isImageAttachment ? '4px 6px 2px 6px' : 0,
                                boxSizing: 'border-box'
                              }}>
                                {!isPollMsg && renderContentWithMentions(msg.content, msg)}
                                {msg.isEdited && (
                                  <span style={{ fontSize: '0.68rem', opacity: 0.7, marginLeft: '6px', fontStyle: 'italic' }}>
                                    (edited)
                                  </span>
                                )}
                              </div>
                            )}

                            {/* Embedded interactive tool widgets for ERP Copilot / Orchestrator */}
                            {Array.isArray(msg.toolEvents) && msg.toolEvents.map((evt, tIdx) => (
                              <ToolResultDispatcher
                                key={`copilot_tool_${tIdx}`}
                                toolName={evt.tool}
                                result={evt.result}
                                onCardAction={handleCopilotCardAction}
                              />
                            ))}
                              </>
                            )}
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
                              if (msg.sendFailed) {
                                return (
                                  <button
                                    type="button"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      handleRetryFailedMessage(msg);
                                    }}
                                    style={{
                                      background: 'none',
                                      border: 'none',
                                      padding: 0,
                                      cursor: 'pointer',
                                      color: '#ef4444',
                                      display: 'inline-flex',
                                      alignItems: 'center',
                                      gap: '2px',
                                      fontWeight: 700,
                                      fontSize: '0.66rem'
                                    }}
                                    title={msg.sendError || 'Failed to send. Click to retry.'}
                                  >
                                    <AlertCircle size={11} color="#ef4444" />
                                    <span>Failed (Retry)</span>
                                  </button>
                                );
                              }

                              if (msg.isOptimistic) {
                                return (
                                  <Clock
                                    size={11}
                                    color="var(--text-muted, #94a3b8)"
                                    style={{ marginLeft: '2px' }}
                                    title="Sending..."
                                  />
                                );
                              }

                              const myIdStr = String(currentUser?._id || currentUser?.id || '');
                              const isRead = Boolean(
                                msg.status === 'read' ||
                                (msg.readBy &&
                                  msg.readBy.some((u) => {
                                    const uId = String(typeof u === 'object' ? (u._id || u.id) : u);
                                    return uId && uId !== myIdStr;
                                  }))
                              );

                              const isDelivered = Boolean(
                                isRead ||
                                msg.status === 'delivered' ||
                                (msg.deliveredTo &&
                                  msg.deliveredTo.some((u) => {
                                    const uId = String(typeof u === 'object' ? (u._id || u.id) : u);
                                    return uId && uId !== myIdStr;
                                  }))
                              );

                              if (isRead) {
                                return (
                                  <CheckCheck
                                    size={13}
                                    color="#2563eb"
                                    style={{ strokeWidth: 2.4, marginLeft: '2px' }}
                                    title="Read"
                                  />
                                );
                              }

                              if (isDelivered) {
                                return (
                                  <CheckCheck
                                    size={13}
                                    color="#94a3b8"
                                    style={{ strokeWidth: 2, marginLeft: '2px' }}
                                    title="Delivered to device"
                                  />
                                );
                              }

                              return (
                                <Check
                                  size={12}
                                  color="#94a3b8"
                                  style={{ strokeWidth: 2, marginLeft: '2px' }}
                                  title="Sent"
                                />
                              );
                            })()}
                          </div>

                          {/* Existing Reaction Badges (WhatsApp Style Overlapping Pill) */}
                          {!msg.isDeleted && msg.reactions && (
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

                              </div>
                            </div>
                          );
                        })}
                      </div>
                    ));
                  })()}
                </ErrorBoundary>
                <div ref={chatBottomRef} />
              </div>

              {/* Floating Scroll-to-Bottom Down Button */}
              {showScrollBottom && (
                <button
                  type="button"
                  onClick={() => scrollToChatBottom(true)}
                  className="phoenix-scroll-bottom-btn"
                  title="Scroll to bottom"
                  aria-label="Scroll to bottom"
                >
                  <ChevronDown size={20} strokeWidth={2.5} />
                  {unreadBelowCount > 0 && (
                    <span className="phoenix-scroll-bottom-badge">
                      {unreadBelowCount > 99 ? '99+' : unreadBelowCount}
                    </span>
                  )}
                </button>
              )}
            </div>

              {/* Real-time Typing Indicator Wave */}
              {typingUsers.length > 0 && (
                <div style={{
                  padding: '4px 1rem',
                  fontSize: '0.74rem',
                  color: '#2563eb',
                  fontWeight: 600,
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  background: 'var(--bg-card, #ffffff)',
                  borderTop: '1px solid var(--border-light, #e3e6ed)'
                }}>
                  <div style={{ display: 'inline-flex', alignItems: 'center', gap: '3px' }}>
                    <span style={{ width: 5, height: 5, borderRadius: '50%', background: '#2563eb', display: 'inline-block', animation: 'typingBounce 1.4s infinite ease-in-out both' }} />
                    <span style={{ width: 5, height: 5, borderRadius: '50%', background: '#2563eb', display: 'inline-block', animation: 'typingBounce 1.4s infinite ease-in-out both', animationDelay: '0.2s' }} />
                    <span style={{ width: 5, height: 5, borderRadius: '50%', background: '#2563eb', display: 'inline-block', animation: 'typingBounce 1.4s infinite ease-in-out both', animationDelay: '0.4s' }} />
                  </div>
                  <span>{typingUsers.join(', ')} {typingUsers.length === 1 ? 'is typing...' : 'are typing...'}</span>
                </div>
              )}

              {/* Quoted Inline Reply Banner */}
              {replyToMessage && (
                <div style={{ padding: '0.45rem 0.85rem', background: 'rgba(37,99,235,0.08)', borderTop: '1px solid #bfdbfe', borderLeft: '4px solid #2563eb', display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: '0.76rem', color: '#1d4ed8', fontWeight: 600, gap: '8px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', overflow: 'hidden', minWidth: 0, flex: 1 }}>
                    <Reply size={14} color="#2563eb" style={{ flexShrink: 0 }} />
                    <div style={{ minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      <span style={{ fontWeight: 800 }}>Replying to {typeof replyToMessage.senderId === 'object' ? (replyToMessage.senderId.name || replyToMessage.senderId.username) : 'Staff'}: </span>
                      <span style={{ opacity: 0.9 }}>{replyToMessage.content?.substring(0, 80)}</span>
                    </div>
                  </div>
                  <button onClick={() => setReplyToMessage(null)} aria-label="Cancel reply" style={{ background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '4px', borderRadius: '4px', flexShrink: 0 }}>
                    <X size={15} />
                  </button>
                </div>
              )}

              {/* Uploading Status Indicator */}
              {uploadingFile && (
                <div
                  style={{
                    padding: '0.55rem 1rem',
                    background: 'linear-gradient(90deg, #eff6ff 0%, #dbeafe 100%)',
                    borderTop: '1px solid #93c5fd',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: '12px',
                    fontSize: '0.8rem',
                    fontWeight: 700,
                    color: '#1d4ed8'
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', minWidth: 0 }}>
                    <RefreshCw size={15} className="spin-loader" style={{ flexShrink: 0 }} />
                    <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      Uploading attachment to Cloudflare R2...
                    </span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexShrink: 0 }}>
                    <div style={{ width: '70px', height: '6px', background: '#bfdbfe', borderRadius: '3px', overflow: 'hidden' }}>
                      <div style={{ width: `${uploadChatProgress || 40}%`, height: '100%', background: '#2563eb', transition: 'width 0.3s ease' }} />
                    </div>
                    <span style={{ fontSize: '0.75rem', fontWeight: 800 }}>{uploadChatProgress || 40}%</span>
                  </div>
                </div>
              )}

              {/* Enhanced Attachment Preview Banner */}
              {attachedFile && !uploadingFile && (
                <div
                  style={{
                    padding: '0.55rem 1rem',
                    background: 'var(--bg-card, #ffffff)',
                    borderTop: '1px solid var(--border-light, #e2e8f0)',
                    boxShadow: '0 -2px 10px rgba(0,0,0,0.03)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: '12px'
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px', minWidth: 0, flex: 1 }}>
                    {/* Thumbnail or Badge */}
                    {attachedFile.fileType === 'image' && attachedFile.fileUrl ? (
                      <img
                        src={attachedFile.fileUrl}
                        alt="Preview"
                        onClick={() => {
                          setViewerZoom(1);
                          setViewerRotation(0);
                          setAttachmentViewer({
                            url: attachedFile.fileUrl,
                            fileName: attachedFile.fileName || 'Preview',
                            fileType: 'image',
                            fileSize: attachedFile.fileSize,
                            senderName: 'Draft Attachment'
                          });
                        }}
                        style={{ width: 38, height: 38, borderRadius: 6, objectFit: 'cover', border: '1px solid var(--border-light)', cursor: 'zoom-in' }}
                      />
                    ) : (
                      <div
                        onClick={() => {
                          if (attachedFile.fileUrl) {
                            setViewerZoom(1);
                            setViewerRotation(0);
                            setAttachmentViewer({
                              url: attachedFile.fileUrl,
                              fileName: attachedFile.fileName || 'Attachment',
                              fileType: attachedFile.fileType,
                              fileSize: attachedFile.fileSize,
                              senderName: 'Draft Attachment'
                            });
                          }
                        }}
                        style={{
                          width: 38,
                          height: 38,
                          borderRadius: 6,
                          background: attachedFile.fileType === 'pdf' ? '#fee2e2' : attachedFile.fileType === 'spreadsheet' ? '#d1fae5' : '#dbeafe',
                          color: attachedFile.fileType === 'pdf' ? '#dc2626' : attachedFile.fileType === 'spreadsheet' ? '#059669' : '#2563eb',
                          display: 'flex',
                          flexDirection: 'column',
                          alignItems: 'center',
                          justifyContent: 'center',
                          fontWeight: 900,
                          fontSize: '0.62rem',
                          flexShrink: 0,
                          cursor: attachedFile.fileUrl ? 'pointer' : 'default'
                        }}
                      >
                        {attachedFile.fileType === 'pdf' ? (
                          <>
                            <FileText size={16} />
                            <span>PDF</span>
                          </>
                        ) : attachedFile.fileType === 'spreadsheet' ? (
                          <>
                            <FileSpreadsheet size={16} />
                            <span>XLS</span>
                          </>
                        ) : (
                          <>
                            <Paperclip size={16} />
                            <span>DOC</span>
                          </>
                        )}
                      </div>
                    )}

                    <div style={{ minWidth: 0, flex: 1 }}>
                      <div
                        style={{
                          fontWeight: 700,
                          fontSize: '0.82rem',
                          color: 'var(--text-primary)',
                          whiteSpace: 'nowrap',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis'
                        }}
                        title={attachedFile.fileName}
                      >
                        {attachedFile.fileName}
                      </div>
                      <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <span>{attachedFile.fileType === 'pdf' ? 'PDF Document' : attachedFile.fileType === 'image' ? 'Image' : attachedFile.fileType === 'spreadsheet' ? 'Spreadsheet' : 'File'}</span>
                        {attachedFile.fileSize && <span>• {formatFileSize(attachedFile.fileSize)}</span>}
                        {attachedFile.fileUrl && (
                          <button
                            type="button"
                            onClick={() => {
                              setViewerZoom(1);
                              setViewerRotation(0);
                              setAttachmentViewer({
                                url: attachedFile.fileUrl,
                                fileName: attachedFile.fileName || 'Attachment',
                                fileType: attachedFile.fileType,
                                fileSize: attachedFile.fileSize,
                                senderName: 'Draft Attachment'
                              });
                            }}
                            style={{
                              background: 'none',
                              border: 'none',
                              padding: 0,
                              color: '#2563eb',
                              fontWeight: 700,
                              textDecoration: 'underline',
                              cursor: 'pointer',
                              fontSize: 'inherit'
                            }}
                          >
                            Preview
                          </button>
                        )}
                      </div>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => setAttachedFile(null)}
                    style={{
                      padding: '4px',
                      background: 'rgba(239,68,68,0.1)',
                      border: '1px solid rgba(239,68,68,0.2)',
                      borderRadius: '50%',
                      color: '#ef4444',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center'
                    }}
                    title="Remove attachment"
                  >
                    <X size={15} />
                  </button>
                </div>
              )}

              {/* Editing Message Banner */}
              {editingMessage && (
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '6px 12px',
                    background: '#eff6ff',
                    border: '1.5px solid #bfdbfe',
                    borderRadius: '8px',
                    marginBottom: '6px',
                    fontSize: '0.8rem',
                    color: '#1d4ed8',
                    animation: 'fadeIn 0.15s ease'
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px', overflow: 'hidden' }}>
                    <Edit3 size={14} color="#2563eb" />
                    <span style={{ fontWeight: 800 }}>Editing:</span>
                    <span style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '300px', color: '#475569' }}>
                      {editingMessage.content}
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setEditingMessage(null);
                      setInputMessage('');
                    }}
                    style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#64748b', display: 'flex', alignItems: 'center', padding: '2px' }}
                    title="Cancel editing"
                  >
                    <X size={14} />
                  </button>
                </div>
              )}

              {/* Chat Input Form (Compact Modern Single-Row SaaS Bar) */}
              <form
                onSubmit={handleSendMessage}
                className="phoenix-chat-input-bar"
                style={{ position: 'relative' }}
                onDragEnter={handleChatDragEnter}
                onDragOver={handleChatDragOver}
                onDragLeave={handleChatDragLeave}
                onDrop={handleChatDrop}
                onPaste={handlePasteClipboard}
              >
                {/* Hidden File Input for Attachments and Photos */}
                <input
                  type="file"
                  id="phoenix-chat-file-input"
                  ref={fileInputRef}
                  style={{ display: 'none' }}
                  onChange={handleFileUpload}
                  accept="image/*,.pdf,.doc,.docx,.xls,.xlsx,.csv,.txt,.zip,.md,.markdown,.json,audio/*"
                  multiple
                />

                {/* @mention Suggestion Dropdown */}
                {mentionQuery !== null && mentionCandidates.length > 0 && (
                  <div
                    style={{
                      position: 'absolute',
                      bottom: 'calc(100% + 8px)',
                      left: '12px',
                      right: '12px',
                      background: '#ffffff',
                      border: '1.5px solid #bfdbfe',
                      borderRadius: '12px',
                      boxShadow: '0 12px 30px rgba(0, 0, 0, 0.15)',
                      overflow: 'hidden',
                      zIndex: 60,
                      maxHeight: '210px',
                      overflowY: 'auto'
                    }}
                  >
                    <div style={{ padding: '6px 12px', background: '#f8fafc', borderBottom: '1px solid #e2e8f0', fontSize: '0.72rem', fontWeight: 800, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                      Mention team member (Use ↑↓ and Enter)
                    </div>
                    {mentionCandidates.map((u, idx) => {
                      const isSelected = idx === mentionIndex;
                      const isAll = u.isSpecialAll || u._id === 'ALL_MEMBERS' || u.name === 'all';
                      const uName = isAll ? 'all' : (u.name || u.username || 'Staff');
                      const uRole = isAll ? 'EVERYONE' : (u.department || u.role || 'Member');
                      return (
                        <div
                          key={u._id || u.id}
                          onClick={() => handleSelectMention(u)}
                          onMouseEnter={() => setMentionIndex(idx)}
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            padding: '8px 12px',
                            background: isSelected ? (isAll ? 'rgba(245, 158, 11, 0.14)' : 'rgba(37, 99, 235, 0.1)') : 'transparent',
                            cursor: 'pointer',
                            transition: 'background 0.1s ease',
                            borderBottom: idx < mentionCandidates.length - 1 ? '1px solid #f1f5f9' : 'none'
                          }}
                        >
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <div style={{
                              width: 26,
                              height: 26,
                              borderRadius: '50%',
                              background: isAll ? 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)' : '#2563eb',
                              color: '#ffffff',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              fontWeight: 800,
                              fontSize: '0.75rem'
                            }}>
                              {isAll ? <Users size={13} color="#ffffff" /> : uName.charAt(0).toUpperCase()}
                            </div>
                            <div>
                              <div style={{ fontSize: '0.82rem', fontWeight: 700, color: isAll ? '#b45309' : '#0f172a' }}>
                                {isAll ? '@all (All Members)' : uName}
                              </div>
                              <div style={{ fontSize: '0.7rem', color: '#64748b' }}>
                                {isAll ? 'Notify everyone in this conversation' : `@${u.username || uName.toLowerCase().replace(/\s+/g, '')}`}
                              </div>
                            </div>
                          </div>
                          <span style={{
                            fontSize: '0.68rem',
                            padding: '2px 6px',
                            background: isAll ? '#fef3c7' : '#e2e8f0',
                            borderRadius: '4px',
                            color: isAll ? '#92400e' : '#475569',
                            fontWeight: 700
                          }}>
                            {uRole}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                )}

                {isRecordingAudio ? (
                  <div style={{
                    width: '100%',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    background: slideCancelActive ? '#fef2f2' : '#fee2e2',
                    border: slideCancelActive ? '1.5px dashed #ef4444' : '1px solid #fca5a5',
                    padding: '0.35rem 0.75rem',
                    borderRadius: '20px',
                    color: '#b91c1c',
                    fontWeight: 700,
                    fontSize: '0.8rem',
                    transition: 'all 0.15s ease'
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem' }}>
                      <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#ef4444' }} />
                      <span>{slideCancelActive ? 'Release to Cancel ✕' : `Recording... ${String(Math.floor(recordingSeconds / 60)).padStart(2, '0')}:${String(recordingSeconds % 60).padStart(2, '0')}`}</span>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem' }}>
                      <button type="button" onClick={cancelAudioRecording} style={{ background: 'none', border: 'none', color: '#dc2626', fontWeight: 700, cursor: 'pointer', fontSize: '0.78rem' }}>Cancel</button>
                      <button
                        type="button"
                        onClick={() => stopAudioRecording(true)}
                        className="phoenix-send-btn-compact"
                        style={{ width: '30px', height: '30px', minWidth: '30px', minHeight: '30px' }}
                      >
                        <Send size={12} color="#ffffff" strokeWidth={2.5} />
                      </button>
                    </div>
                  </div>
                ) : (
                  <>
                    {/* Left Actions */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: '4px', flexShrink: 0 }}>
                      {/* More tools / Actions popover (+) button */}
                      <div style={{ position: 'relative' }}>
                        <button
                          type="button"
                          className="phoenix-toolbar-icon"
                          onClick={() => setShowMobileActionMenu(!showMobileActionMenu)}
                          style={{
                            background: showMobileActionMenu ? '#eff6ff' : 'transparent',
                            color: showMobileActionMenu ? '#2563eb' : '#64748b',
                            borderRadius: '50%',
                            width: '32px',
                            height: '32px',
                            minWidth: '32px',
                            minHeight: '32px'
                          }}
                          title="Actions & Tools"
                        >
                          <Plus size={18} />
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
                              background: '#ffffff',
                              border: '1px solid #e2e8f0',
                              borderRadius: '12px',
                              boxShadow: '0 10px 25px rgba(0,0,0,0.15)',
                              zIndex: 9999,
                              padding: '6px',
                              minWidth: '220px',
                              display: 'flex',
                              flexDirection: 'column',
                              gap: '2px'
                            }}>
                              <button
                                type="button"
                                onClick={() => {
                                  setShowMobileActionMenu(false);
                                  openFileDialog('image/*');
                                }}
                                style={{
                                  display: 'flex', alignItems: 'center', gap: '8px', padding: '8px 12px',
                                  background: 'transparent', border: 'none', borderRadius: '6px', textAlign: 'left',
                                  fontSize: '0.8rem', color: '#0f172a', cursor: 'pointer', fontWeight: 600
                                }}
                              >
                                <ImageIcon size={15} color="#2563eb" />
                                <span>Upload Photo</span>
                              </button>

                              <button
                                type="button"
                                onClick={() => {
                                  setShowMobileActionMenu(false);
                                  openFileDialog('.pdf,application/pdf');
                                }}
                                style={{
                                  display: 'flex', alignItems: 'center', gap: '8px', padding: '8px 12px',
                                  background: 'transparent', border: 'none', borderRadius: '6px', textAlign: 'left',
                                  fontSize: '0.8rem', color: '#0f172a', cursor: 'pointer', fontWeight: 600
                                }}
                              >
                                <FileText size={15} color="#dc2626" />
                                <span>Attach PDF Document</span>
                              </button>

                              <button
                                type="button"
                                onClick={() => {
                                  setShowMobileActionMenu(false);
                                  openFileDialog('image/*,.pdf,.doc,.docx,.xls,.xlsx,.csv,.txt,.zip,audio/*');
                                }}
                                style={{
                                  display: 'flex', alignItems: 'center', gap: '8px', padding: '8px 12px',
                                  background: 'transparent', border: 'none', borderRadius: '6px', textAlign: 'left',
                                  fontSize: '0.8rem', color: '#0f172a', cursor: 'pointer', fontWeight: 600
                                }}
                              >
                                <Paperclip size={15} color="#2563eb" />
                                <span>Attach Any Document</span>
                              </button>

                              <button
                                type="button"
                                onClick={() => { setShowMobileActionMenu(false); handleOpenShareModal('jobcard'); }}
                                style={{
                                  display: 'flex', alignItems: 'center', gap: '8px', padding: '8px 12px',
                                  background: 'transparent', border: 'none', borderRadius: '6px', textAlign: 'left',
                                  fontSize: '0.8rem', color: '#0f172a', cursor: 'pointer', fontWeight: 600
                                }}
                              >
                                <Share2 size={15} color="#8b5cf6" />
                                <span>Quick Share Record</span>
                              </button>

                              <button
                                type="button"
                                onClick={() => { setShowMobileActionMenu(false); setShowPollModal(true); }}
                                style={{
                                  display: 'flex', alignItems: 'center', gap: '8px', padding: '8px 12px',
                                  background: 'transparent', border: 'none', borderRadius: '6px', textAlign: 'left',
                                  fontSize: '0.8rem', color: '#0f172a', cursor: 'pointer', fontWeight: 600
                                }}
                              >
                                <BarChart2 size={15} color="#059669" />
                                <span>Create Poll</span>
                              </button>

                              <button
                                type="button"
                                onClick={() => { setShowMobileActionMenu(false); handleOpenTaskModalFromChat(); }}
                                style={{
                                  display: 'flex', alignItems: 'center', gap: '8px', padding: '8px 12px',
                                  background: 'transparent', border: 'none', borderRadius: '6px', textAlign: 'left',
                                  fontSize: '0.8rem', color: '#0f172a', cursor: 'pointer', fontWeight: 600
                                }}
                              >
                                <CheckSquare size={15} color="#10b981" />
                                <span>Create Task</span>
                              </button>

                              <button
                                type="button"
                                onClick={() => { setShowMobileActionMenu(false); setIsUrgent(!isUrgent); }}
                                style={{
                                  display: 'flex', alignItems: 'center', gap: '8px', padding: '8px 12px',
                                  background: isUrgent ? '#fee2e2' : 'transparent', border: 'none', borderRadius: '6px', textAlign: 'left',
                                  fontSize: '0.8rem', color: isUrgent ? '#dc2626' : '#0f172a', cursor: 'pointer', fontWeight: 600
                                }}
                              >
                                <AlertTriangle size={15} color="#dc2626" />
                                <span>{isUrgent ? 'Disable Urgent Alert' : 'Mark as Urgent (SOS)'}</span>
                              </button>
                            </div>
                          </>
                        )}
                      </div>

                      {/* On desktop: direct paperclip and emoji buttons */}
                      {!isMobileScreen && (
                        <>
                          <button
                            type="button"
                            className="phoenix-toolbar-icon"
                            onClick={(e) => {
                              e.preventDefault();
                              openFileDialog('image/*,.pdf,.doc,.docx,.xls,.xlsx,.csv,.txt,.zip,audio/*');
                            }}
                            title="Attach File (PDF, Image, Document)"
                            style={{ width: '32px', height: '32px', minWidth: '32px', minHeight: '32px', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', margin: 0, background: 'none', border: 'none' }}
                          >
                            <Paperclip size={16} />
                          </button>

                          <div style={{ position: 'relative' }}>
                            <button
                              type="button"
                              className="phoenix-toolbar-icon"
                              title="Emoji Picker"
                              onClick={() => setShowEmojiPicker(!showEmojiPicker)}
                              style={{ width: '32px', height: '32px', minWidth: '32px', minHeight: '32px' }}
                            >
                              <Smile size={16} />
                            </button>

                            <EmojiPickerPopover
                              isOpen={showEmojiPicker}
                              onClose={() => setShowEmojiPicker(false)}
                              onSelectEmoji={(emo) => {
                                setInputMessage((prev) => prev + emo);
                                if (chatTextareaRef.current) chatTextareaRef.current.focus();
                              }}
                            />
                          </div>
                        </>
                      )}
                    </div>

                    {/* Center: Compact Text Input Pill */}
                    <div className="phoenix-chat-input-pill">
                      {isUrgent && (
                        <span style={{ fontSize: '0.65rem', fontWeight: 900, background: '#ef4444', color: '#fff', padding: '1px 5px', borderRadius: '4px', marginRight: '6px', flexShrink: 0 }}>
                          SOS
                        </span>
                      )}
                      <textarea
                        ref={chatTextareaRef}
                        rows={1}
                        placeholder={isUrgent ? "🚨 Urgent SOS Message..." : "Type a message..."}
                        value={inputMessage}
                        onPaste={handlePasteClipboard}
                        onKeyDown={(e) => {
                          if (e.key === 'Escape') {
                            if (showEmojiPicker) {
                              e.preventDefault();
                              e.stopPropagation();
                              setShowEmojiPicker(false);
                              return;
                            }
                            if (mentionQuery !== null) {
                              e.preventDefault();
                              e.stopPropagation();
                              setMentionQuery(null);
                              return;
                            }
                          }
                          if (mentionQuery !== null) {
                            if (mentionCandidates.length > 0) {
                              if (e.key === 'ArrowDown') {
                                e.preventDefault();
                                setMentionIndex((prev) => (prev + 1) % mentionCandidates.length);
                                return;
                              }
                              if (e.key === 'ArrowUp') {
                                e.preventDefault();
                                setMentionIndex((prev) => (prev - 1 + mentionCandidates.length) % mentionCandidates.length);
                                return;
                              }
                              if (e.key === 'Enter' || e.key === 'Tab') {
                                e.preventDefault();
                                if (mentionCandidates[mentionIndex]) {
                                  handleSelectMention(mentionCandidates[mentionIndex]);
                                  return;
                                }
                              }
                            }
                          }
                          if (e.key === 'Enter' && !e.shiftKey) {
                            e.preventDefault();
                            if (mentionQuery !== null) setMentionQuery(null);
                            handleSendMessage(e);
                          }
                        }}
                        onFocus={() => {
                          setTimeout(() => {
                            if (chatScrollRef.current) {
                              chatScrollRef.current.scrollTop = chatScrollRef.current.scrollHeight;
                            }
                          }, 100);
                        }}
                        onChange={handleInputChange}
                        className="phoenix-chat-textarea"
                      />
                    </div>

                    {/* Right Actions */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: '4px', flexShrink: 0 }}>
                      {/* Push to talk / Voice Note icon if no text */}
                      {!inputMessage.trim() && !attachedFile && (
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
                          title="Voice Note (Hold or tap)"
                          style={{ width: '32px', height: '32px', minWidth: '32px', minHeight: '32px' }}
                        >
                          <Mic size={17} />
                        </button>
                      )}

                      {/* Compact Circular Send Button */}
                      <button
                        type="submit"
                        disabled={(!inputMessage.trim() && !attachedFile) || uploadingFile}
                        className="phoenix-send-btn-compact"
                        title={uploadingFile ? "Uploading attachment..." : "Send Message"}
                        style={uploadingFile ? { opacity: 0.7, cursor: 'not-allowed' } : {}}
                        onMouseDown={() => {
                          if (mentionQuery !== null) {
                            setMentionQuery(null);
                          }
                        }}
                        onClick={() => {
                          if (mentionQuery !== null) {
                            setMentionQuery(null);
                          }
                        }}
                      >
                        {uploadingFile ? (
                          <RefreshCw size={13} className="spin-loader" color="#ffffff" />
                        ) : (
                          <Send size={15} style={{ marginLeft: '1px' }} />
                        )}
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
            <div style={{ padding: '1.1rem 1.4rem', borderBottom: '1px solid var(--border-light)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'linear-gradient(135deg, #1e40af 0%, #2563eb 100%)', color: '#fff' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                <div style={{ width: 36, height: 36, borderRadius: '10px', background: 'rgba(255,255,255,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff' }}>
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
                            <span
                              style={{
                                width: 7,
                                height: 7,
                                borderRadius: '50%',
                                background: onlineUserIds.has(String(u._id)) ? '#22c55e' : '#94a3b8',
                                display: 'inline-block',
                                flexShrink: 0
                              }}
                              title={onlineUserIds.has(String(u._id)) ? 'Online' : 'Offline'}
                            />
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
                  {groupMembers.map((m) => {
                    const mId = String(m._id || m.id || m);
                    const isOnline = onlineUserIds.has(mId);
                    return (
                      <div
                        key={mId}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          padding: '0.5rem 0.75rem',
                          borderRadius: '8px',
                          background: 'var(--bg-main)',
                          border: '1px solid var(--border-light)'
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
                          <span
                            style={{
                              width: 8,
                              height: 8,
                              borderRadius: '50%',
                              background: isOnline ? '#22c55e' : '#94a3b8',
                              display: 'inline-block',
                              flexShrink: 0,
                              boxShadow: isOnline ? '0 0 0 2px rgba(34, 197, 94, 0.25)' : 'none'
                            }}
                            title={isOnline ? 'Online now' : 'Offline'}
                          />
                          <div>
                            <div style={{ fontSize: '0.82rem', fontWeight: 700, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '5px' }}>
                              <span>{m.name || m.username || 'Staff'}</span>
                              <span style={{ fontSize: '0.66rem', fontWeight: 600, color: isOnline ? '#16a34a' : '#94a3b8' }}>
                                • {isOnline ? 'Online' : 'Offline'}
                              </span>
                            </div>
                            <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>{m.email}</div>
                          </div>
                        </div>
                        <span
                          style={{
                            fontSize: '0.65rem',
                            fontWeight: 800,
                            textTransform: 'uppercase',
                            padding: '2px 8px',
                            borderRadius: '10px',
                            background: m.role === 'admin' ? 'rgba(37,99,235,0.12)' : 'rgba(100,116,139,0.12)',
                            color: m.role === 'admin' ? 'var(--primary)' : 'var(--text-muted)'
                          }}
                        >
                          {m.role || 'user'}
                        </span>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ── WHATSAPP-STYLE UNIVERSAL ATTACHMENT VIEWER ── */}
      {attachmentViewer && (() => {
        const fileUrl = attachmentViewer.url;
        let fileName = attachmentViewer.fileName || '';
        if (!fileName || fileName.toLowerCase() === 'blob' || fileName.startsWith('blob:') || fileName.toLowerCase() === 'image' || fileName === 'Attachment') {
          const fromUrl = typeof fileUrl === 'string' ? decodeURIComponent(fileUrl.split('/').pop().split('?')[0]) : '';
          fileName = fromUrl || 'Attachment';
        }
        const lowerName = fileName.toLowerCase();
        const isImg = attachmentViewer.fileType === 'image' || /\.(jpg|jpeg|png|webp|gif|svg|bmp)$/i.test(lowerName);
        const isPdf = attachmentViewer.fileType === 'pdf' || lowerName.endsWith('.pdf');
        const isCsv = /\.(csv|tsv)$/i.test(lowerName) || attachmentViewer.fileType === 'csv';
        const isText = /\.(txt|log|json|md|xml|yml|yaml|ini|env)$/i.test(lowerName) || attachmentViewer.fileType === 'text';
        const isSpreadsheet = attachmentViewer.fileType === 'spreadsheet' || /\.(xls|xlsx)$/i.test(lowerName);
        const isDoc = /\.(doc|docx|rtf)$/i.test(lowerName);

        const vBtnStyle = {
          background: 'rgba(255, 255, 255, 0.12)',
          color: '#ffffff',
          border: 'none',
          borderRadius: '6px',
          height: '34px',
          minWidth: '34px',
          padding: '0 8px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          cursor: 'pointer',
          textDecoration: 'none',
          transition: 'background 0.15s ease'
        };

        return (
          <div
            tabIndex={-1}
            onKeyDown={(e) => {
              if (e.key === 'Escape') setAttachmentViewer(null);
            }}
            style={{
              position: 'fixed',
              inset: 0,
              zIndex: 999999,
              background: 'rgba(11, 15, 25, 0.96)',
              backdropFilter: 'blur(10px)',
              display: 'flex',
              flexDirection: 'column',
              outline: 'none',
              userSelect: 'none'
            }}
          >
            {/* Top Toolbar */}
            <div
              style={{
                height: '60px',
                padding: '0 1rem',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                borderBottom: '1px solid rgba(255, 255, 255, 0.08)',
                background: 'rgba(17, 24, 39, 0.88)',
                color: '#ffffff',
                flexShrink: 0
              }}
            >
              {/* Left: Back/Close & Metadata */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px', minWidth: 0 }}>
                <button
                  type="button"
                  onClick={() => setAttachmentViewer(null)}
                  style={{
                    background: 'rgba(255, 255, 255, 0.12)',
                    border: 'none',
                    borderRadius: '50%',
                    width: 36,
                    height: 36,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: '#ffffff',
                    cursor: 'pointer'
                  }}
                  title="Close (Esc)"
                >
                  <ArrowLeft size={18} />
                </button>
                <div style={{ minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span
                      style={{
                        fontWeight: 700,
                        fontSize: '0.92rem',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                        maxWidth: '45vw'
                      }}
                      title={fileName}
                    >
                      {fileName}
                    </span>
                    {attachmentViewer.fileSize ? (
                      <span style={{ fontSize: '0.68rem', padding: '1px 6px', borderRadius: '4px', background: 'rgba(255, 255, 255, 0.15)', opacity: 0.85 }}>
                        {formatFileSize(attachmentViewer.fileSize)}
                      </span>
                    ) : null}
                  </div>
                  {attachmentViewer.senderName && (
                    <div style={{ fontSize: '0.72rem', color: '#94a3b8', marginTop: '1px' }}>
                      {attachmentViewer.senderName}{attachmentViewer.createdAt ? ` • ${formatTime(attachmentViewer.createdAt)}` : ''}
                    </div>
                  )}
                </div>
              </div>

              {/* Right: Controls */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                {isImg && (
                  <>
                    <button
                      type="button"
                      onClick={() => setViewerZoom((prev) => Math.max(0.4, Number((prev - 0.25).toFixed(2))))}
                      style={vBtnStyle}
                      title="Zoom Out (-)"
                    >
                      <ZoomOut size={16} />
                    </button>
                    <button
                      type="button"
                      onClick={() => setViewerZoom(1)}
                      style={{ ...vBtnStyle, fontSize: '0.72rem', fontWeight: 700, minWidth: '46px' }}
                      title="Reset Zoom (100%)"
                    >
                      {Math.round(viewerZoom * 100)}%
                    </button>
                    <button
                      type="button"
                      onClick={() => setViewerZoom((prev) => Math.min(4, Number((prev + 0.25).toFixed(2))))}
                      style={vBtnStyle}
                      title="Zoom In (+)"
                    >
                      <ZoomIn size={16} />
                    </button>
                    <button
                      type="button"
                      onClick={() => setViewerRotation((prev) => (prev + 90) % 360)}
                      style={vBtnStyle}
                      title="Rotate 90°"
                    >
                      <RotateCw size={16} />
                    </button>
                  </>
                )}

                <a
                  href={fileUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={vBtnStyle}
                  title="Open in new window"
                >
                  <ExternalLink size={16} />
                </a>

                <button
                  type="button"
                  onClick={() => handleDownloadAttachment(fileUrl, fileName)}
                  style={{
                    background: '#2563eb',
                    color: '#ffffff',
                    border: 'none',
                    padding: '6px 14px',
                    borderRadius: '6px',
                    fontSize: '0.8rem',
                    fontWeight: 700,
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '6px',
                    cursor: 'pointer',
                    transition: 'background 0.15s ease'
                  }}
                  title="Download file"
                >
                  <Download size={15} />
                  <span>Download</span>
                </button>

                <button
                  type="button"
                  onClick={() => setAttachmentViewer(null)}
                  style={{ ...vBtnStyle, marginLeft: '4px' }}
                  title="Close viewer"
                >
                  <X size={18} />
                </button>
              </div>
            </div>

            {/* Viewer Body */}
            <div
              style={{
                flex: 1,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                padding: isPdf || isSpreadsheet || isDoc ? '0.75rem 1rem 1rem' : '1rem',
                overflow: 'hidden',
                position: 'relative'
              }}
              onClick={(e) => {
                if (e.target === e.currentTarget && isImg) setAttachmentViewer(null);
              }}
            >
              {isImg ? (
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    width: '100%',
                    height: '100%',
                    overflow: viewerZoom > 1 ? 'auto' : 'hidden'
                  }}
                >
                  <img
                    src={fileUrl}
                    alt={fileName}
                    style={{
                      maxWidth: viewerZoom === 1 ? '92vw' : 'none',
                      maxHeight: viewerZoom === 1 ? '82vh' : 'none',
                      transform: `scale(${viewerZoom}) rotate(${viewerRotation}deg)`,
                      transformOrigin: 'center center',
                      transition: 'transform 0.15s ease-out',
                      borderRadius: '6px',
                      boxShadow: '0 10px 40px rgba(0,0,0,0.7)',
                      objectFit: 'contain'
                    }}
                  />
                </div>
              ) : isPdf ? (
                <div style={{ width: '100%', height: '100%', maxWidth: '1100px', borderRadius: '8px', overflow: 'hidden', background: '#ffffff', boxShadow: '0 8px 32px rgba(0,0,0,0.5)' }}>
                  <iframe
                    src={fileUrl}
                    title={fileName}
                    style={{ width: '100%', height: '100%', border: 'none' }}
                  />
                </div>
              ) : isText ? (
                <div style={{ width: '100%', height: '100%', maxWidth: '1100px', borderRadius: '8px', overflow: 'hidden', background: '#0f172a', boxShadow: '0 8px 32px rgba(0,0,0,0.5)' }}>
                  <TextFileViewer fileUrl={fileUrl} fileName={fileName} />
                </div>
              ) : isCsv ? (
                <div style={{ width: '100%', height: '100%', maxWidth: '1100px', borderRadius: '8px', overflow: 'hidden', background: '#ffffff', boxShadow: '0 8px 32px rgba(0,0,0,0.5)' }}>
                  <CsvDataViewer fileUrl={fileUrl} fileName={fileName} />
                </div>
              ) : (
                <div style={{ width: '100%', height: '100%', maxWidth: '1100px', borderRadius: '8px', overflow: 'hidden', background: '#ffffff', boxShadow: '0 8px 32px rgba(0,0,0,0.5)' }}>
                  <iframe
                    src={`https://docs.google.com/viewer?url=${encodeURIComponent(fileUrl)}&embedded=true`}
                    title={fileName}
                    style={{ width: '100%', height: '100%', border: 'none' }}
                  />
                </div>
              )}
            </div>
          </div>
        );
      })()}

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
                              onClick={() => {
                                setViewerZoom(1);
                                setViewerRotation(0);
                                setAttachmentViewer({
                                  url: att.fileUrl,
                                  fileName: att.fileName || 'Photo',
                                  fileType: 'image',
                                  fileSize: att.fileSize,
                                  senderName: m.senderId?.name || 'Staff',
                                  createdAt: m.createdAt
                                });
                              }}
                              style={{ width: '100%', height: '110px', objectFit: 'cover', cursor: 'zoom-in' }}
                            />
                          ) : (
                            <div
                              onClick={() => {
                                if (isAudio) return;
                                const isPdf = att.fileType === 'pdf' || att.fileName?.toLowerCase().endsWith('.pdf');
                                const isSheet = ['xlsx', 'xls', 'csv'].some((ext) => att.fileName?.toLowerCase().endsWith(ext));
                                setViewerZoom(1);
                                setViewerRotation(0);
                                setAttachmentViewer({
                                  url: att.fileUrl,
                                  fileName: att.fileName || 'Document',
                                  fileType: isPdf ? 'pdf' : isSheet ? 'spreadsheet' : 'document',
                                  fileSize: att.fileSize,
                                  senderName: m.senderId?.name || 'Staff',
                                  createdAt: m.createdAt
                                });
                              }}
                              style={{
                                height: '110px',
                                background: isAudio ? '#eff6ff' : '#f8fafc',
                                display: 'flex',
                                flexDirection: 'column',
                                alignItems: 'center',
                                justifyContent: 'center',
                                padding: '0.5rem',
                                cursor: isAudio ? 'default' : 'pointer'
                              }}
                            >
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
                              {!isAudio && (
                                <button
                                  type="button"
                                  onClick={() => {
                                    const isPdf = att.fileType === 'pdf' || att.fileName?.toLowerCase().endsWith('.pdf');
                                    const isSheet = ['xlsx', 'xls', 'csv'].some((ext) => att.fileName?.toLowerCase().endsWith(ext));
                                    setViewerZoom(1);
                                    setViewerRotation(0);
                                    setAttachmentViewer({
                                      url: att.fileUrl,
                                      fileName: att.fileName || (isImg ? 'Photo' : 'Document'),
                                      fileType: isImg ? 'image' : isPdf ? 'pdf' : isSheet ? 'spreadsheet' : 'document',
                                      fileSize: att.fileSize,
                                      senderName: m.senderId?.name || 'Staff',
                                      createdAt: m.createdAt
                                    });
                                  }}
                                  style={{
                                    flex: 1,
                                    padding: '0.25rem',
                                    fontSize: '0.68rem',
                                    fontWeight: 600,
                                    textAlign: 'center',
                                    borderRadius: '4px',
                                    background: 'var(--bg-secondary, #f1f5f9)',
                                    color: 'var(--text-primary, #334155)',
                                    border: '1px solid var(--border-light, #cbd5e1)',
                                    cursor: 'pointer'
                                  }}
                                >
                                  Open
                                </button>
                              )}
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

      {/* ── CREATE TASK FROM CHAT MODAL ── */}
      {showChatTaskModal && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 9999, background: 'rgba(15, 23, 42, 0.65)', backdropFilter: 'blur(5px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem' }}>
          <div className="glass-panel" style={{ width: '100%', maxWidth: 540, borderRadius: '16px', overflow: 'hidden', display: 'flex', flexDirection: 'column', animation: 'slideUp 0.2s ease-out', background: 'var(--bg-card, #ffffff)', maxHeight: '90vh' }}>
            <div style={{ padding: '1rem 1.2rem', borderBottom: '1px solid var(--border-light, #e2e8f0)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'var(--bg-th, #f8fafc)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <CheckSquare size={18} color="#10b981" />
                <h3 style={{ margin: 0, fontSize: '0.95rem', fontWeight: 800, color: 'var(--text-primary, #0f172a)' }}>
                  Create Task from Chat
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setShowChatTaskModal(false)}
                className="btn-secondary"
                style={{ padding: '0.2rem 0.5rem', fontSize: '0.75rem', borderRadius: '6px', background: '#f1f5f9', border: '1px solid #cbd5e1', cursor: 'pointer' }}
              >
                Cancel
              </button>
            </div>

            <form onSubmit={handleSubmitChatTask} style={{ padding: '1.2rem', display: 'flex', flexDirection: 'column', gap: '0.85rem', overflowY: 'auto' }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 700, color: 'var(--text-primary, #0f172a)', marginBottom: '4px' }}>
                  Task Title *
                </label>
                <input
                  type="text"
                  placeholder="e.g. Inspect fabric defect before dispatch"
                  value={chatTaskForm.title}
                  onChange={(e) => setChatTaskForm((prev) => ({ ...prev, title: e.target.value }))}
                  style={{ width: '100%', padding: '0.55rem 0.8rem', fontSize: '0.84rem', borderRadius: '8px', border: '1px solid var(--border-light, #cbd5e1)', background: 'var(--bg-input, #ffffff)', color: 'var(--text-primary, #0f172a)', boxSizing: 'border-box' }}
                  required
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 700, color: 'var(--text-primary, #0f172a)', marginBottom: '4px' }}>
                  Description / Context
                </label>
                <textarea
                  rows={3}
                  placeholder="Additional instructions or chat reference details..."
                  value={chatTaskForm.description}
                  onChange={(e) => setChatTaskForm((prev) => ({ ...prev, description: e.target.value }))}
                  style={{ width: '100%', padding: '0.55rem 0.8rem', fontSize: '0.82rem', borderRadius: '8px', border: '1px solid var(--border-light, #cbd5e1)', background: 'var(--bg-input, #ffffff)', color: 'var(--text-primary, #0f172a)', boxSizing: 'border-box', resize: 'vertical' }}
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 700, color: 'var(--text-primary, #0f172a)', marginBottom: '4px' }}>
                    Priority
                  </label>
                  <select
                    value={chatTaskForm.priority}
                    onChange={(e) => setChatTaskForm((prev) => ({ ...prev, priority: e.target.value }))}
                    style={{ width: '100%', padding: '0.55rem 0.8rem', fontSize: '0.84rem', borderRadius: '8px', border: '1px solid var(--border-light, #cbd5e1)', background: 'var(--bg-input, #ffffff)', color: 'var(--text-primary, #0f172a)', boxSizing: 'border-box' }}
                  >
                    <option value="low">Low</option>
                    <option value="medium">Medium</option>
                    <option value="high">High</option>
                    <option value="urgent">Urgent (SOS)</option>
                  </select>
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 700, color: 'var(--text-primary, #0f172a)', marginBottom: '4px' }}>
                    Due Date
                  </label>
                  <input
                    type="date"
                    value={chatTaskForm.dueDate}
                    onChange={(e) => setChatTaskForm((prev) => ({ ...prev, dueDate: e.target.value }))}
                    style={{ width: '100%', padding: '0.55rem 0.8rem', fontSize: '0.84rem', borderRadius: '8px', border: '1px solid var(--border-light, #cbd5e1)', background: 'var(--bg-input, #ffffff)', color: 'var(--text-primary, #0f172a)', boxSizing: 'border-box' }}
                  />
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 700, color: 'var(--text-primary, #0f172a)', marginBottom: '4px' }}>
                    Job / Project Ref
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. Job #2841"
                    value={chatTaskForm.projectRef}
                    onChange={(e) => setChatTaskForm((prev) => ({ ...prev, projectRef: e.target.value }))}
                    style={{ width: '100%', padding: '0.55rem 0.8rem', fontSize: '0.84rem', borderRadius: '8px', border: '1px solid var(--border-light, #cbd5e1)', background: 'var(--bg-input, #ffffff)', color: 'var(--text-primary, #0f172a)', boxSizing: 'border-box' }}
                  />
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 700, color: 'var(--text-primary, #0f172a)', marginBottom: '4px' }}>
                    Client Name
                  </label>
                  <input
                    type="text"
                    placeholder="Optional client name"
                    value={chatTaskForm.clientName}
                    onChange={(e) => setChatTaskForm((prev) => ({ ...prev, clientName: e.target.value }))}
                    style={{ width: '100%', padding: '0.55rem 0.8rem', fontSize: '0.84rem', borderRadius: '8px', border: '1px solid var(--border-light, #cbd5e1)', background: 'var(--bg-input, #ffffff)', color: 'var(--text-primary, #0f172a)', boxSizing: 'border-box' }}
                  />
                </div>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 700, color: 'var(--text-primary, #0f172a)', marginBottom: '6px' }}>
                  Assignees
                </label>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', maxHeight: '110px', overflowY: 'auto', padding: '6px', border: '1px solid var(--border-light, #e2e8f0)', borderRadius: '8px', background: '#fafafa' }}>
                  {(staffUsers && staffUsers.length > 0 ? staffUsers : allUsers).map((u) => {
                    const uId = String(u._id || u.id);
                    const isSelected = Array.isArray(chatTaskForm.assignees) && chatTaskForm.assignees.some((a) => String(a) === uId);
                    return (
                      <button
                        key={uId}
                        type="button"
                        onClick={() => {
                          setChatTaskForm((prev) => {
                            const cur = prev.assignees || [];
                            const exists = cur.some((a) => String(a) === uId);
                            return {
                              ...prev,
                              assignees: exists ? cur.filter((a) => String(a) !== uId) : [...cur, uId]
                            };
                          });
                        }}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: '4px',
                          padding: '3px 8px',
                          borderRadius: '16px',
                          fontSize: '0.74rem',
                          fontWeight: 600,
                          cursor: 'pointer',
                          border: isSelected ? '1px solid #10b981' : '1px solid #cbd5e1',
                          background: isSelected ? '#ecfdf5' : '#ffffff',
                          color: isSelected ? '#065f46' : '#475569'
                        }}
                      >
                        {isSelected && <CheckCircle size={12} color="#10b981" />}
                        <span>{u.name || u.username || 'Staff'}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem', marginTop: '0.5rem', paddingTop: '0.75rem', borderTop: '1px solid var(--border-light, #e2e8f0)' }}>
                <button
                  type="button"
                  onClick={() => setShowChatTaskModal(false)}
                  style={{ padding: '0.55rem 1rem', fontSize: '0.82rem', borderRadius: '8px', border: '1px solid #cbd5e1', background: '#ffffff', color: '#475569', cursor: 'pointer', fontWeight: 600 }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isCreatingChatTask}
                  style={{ padding: '0.55rem 1.2rem', fontSize: '0.82rem', borderRadius: '8px', border: 'none', background: '#10b981', color: '#ffffff', cursor: isCreatingChatTask ? 'not-allowed' : 'pointer', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '6px', opacity: isCreatingChatTask ? 0.7 : 1 }}
                >
                  {isCreatingChatTask && <RefreshCw size={13} className="spin" />}
                  <span>{isCreatingChatTask ? 'Creating...' : 'Create Task'}</span>
                </button>
              </div>
            </form>
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

      {/* ─── INCOMING CALL BANNER / NOTIFICATION (Portal to document.body so it rings over any screen) ─── */}
      {incomingCall && typeof document !== 'undefined' && ReactDOM.createPortal(
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
        </div>,
        document.body
      )}

      {/* ─── ACTIVE CALL MODAL (Portal to document.body so call stays visible over any screen) ─── */}
      {activeCall && typeof document !== 'undefined' && ReactDOM.createPortal(
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
                  <>
                    {/* Main Remote Video Stream */}
                    <video
                      ref={remoteVideoRef}
                      autoPlay
                      playsInline
                      style={{
                        width: '100%',
                        height: '100%',
                        objectFit: 'cover'
                      }}
                    />

                    {/* Floating Local Video PiP Preview */}
                    <div style={{
                      position: 'absolute',
                      bottom: '20px',
                      right: '20px',
                      width: '130px',
                      height: '95px',
                      borderRadius: '10px',
                      overflow: 'hidden',
                      border: '2px solid rgba(255,255,255,0.4)',
                      boxShadow: '0 4px 16px rgba(0,0,0,0.5)',
                      background: '#0f172a',
                      zIndex: 4
                    }}>
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
                    </div>
                  </>
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
        </div>,
        document.body
      )}

      {/* In-App Delete Message Confirmation Modal */}
      {deleteTargetMsg && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            backgroundColor: 'rgba(15, 23, 42, 0.65)',
            backdropFilter: 'blur(4px)',
            WebkitBackdropFilter: 'blur(4px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 99999,
            padding: '1rem'
          }}
          onClick={() => setDeleteTargetMsg(null)}
        >
          <div
            style={{
              background: '#ffffff',
              borderRadius: '14px',
              padding: '1.4rem',
              maxWidth: '380px',
              width: '100%',
              boxShadow: '0 20px 40px rgba(0,0,0,0.25)',
              animation: 'fadeIn 0.15s ease'
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '0.75rem' }}>
              <div style={{ width: 36, height: 36, borderRadius: '50%', background: '#fee2e2', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#dc2626', flexShrink: 0 }}>
                <Trash2 size={18} />
              </div>
              <h4 style={{ margin: 0, fontSize: '1rem', fontWeight: 800, color: '#0f172a' }}>Delete Message?</h4>
            </div>
            <p style={{ margin: '0 0 0.6rem', fontSize: '0.85rem', color: '#64748b', lineHeight: 1.5 }}>
              Are you sure you want to delete this message? It will be removed for everyone in this chat.
            </p>
            {deleteTargetMsg.text && (
              <div
                style={{
                  background: '#f8fafc',
                  border: '1px solid #e2e8f0',
                  borderRadius: '6px',
                  padding: '7px 10px',
                  fontSize: '0.8rem',
                  color: '#334155',
                  maxHeight: '64px',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  marginBottom: '1.1rem',
                  lineHeight: 1.4
                }}
              >
                "{deleteTargetMsg.text.length > 90 ? deleteTargetMsg.text.slice(0, 90) + '…' : deleteTargetMsg.text}"
              </div>
            )}
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
              <button
                type="button"
                onClick={() => setDeleteTargetMsg(null)}
                style={{
                  padding: '7px 14px',
                  borderRadius: '7px',
                  border: '1px solid #cbd5e1',
                  background: '#ffffff',
                  color: '#475569',
                  fontSize: '0.82rem',
                  fontWeight: 600,
                  cursor: 'pointer'
                }}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => {
                  const target = deleteTargetMsg;
                  setDeleteTargetMsg(null);
                  if (target?.id) {
                    confirmDeleteMessage(target.id);
                  }
                }}
                style={{
                  padding: '7px 16px',
                  borderRadius: '7px',
                  border: 'none',
                  background: '#dc2626',
                  color: '#ffffff',
                  fontSize: '0.82rem',
                  fontWeight: 700,
                  cursor: 'pointer',
                  boxShadow: '0 2px 6px rgba(220, 38, 38, 0.3)'
                }}
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ERP Copilot Dialog Window */}
      {showCopilotModal && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 99999,
            background: 'rgba(15, 23, 42, 0.65)',
            backdropFilter: 'blur(4px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '16px'
          }}
          onClick={() => setShowCopilotModal(false)}
        >
          <div onClick={(e) => e.stopPropagation()} style={{ width: '100%', maxWidth: '680px' }}>
            <ChatContainer onClose={() => setShowCopilotModal(false)} />
          </div>
        </div>
      )}

      {/* WebRTC Remote Audio Player (auto-plays incoming voice on speaker) */}
      <audio ref={remoteAudioRef} autoPlay playsInline style={{ display: 'none' }} />
    </div>
  );
}
