import React, { useState, useEffect } from 'react';
import {
  X, Send, Star, Clock, Timer, CheckCheck, Check,
  ExternalLink, Trash2, Forward, MessageSquare, Users
} from 'lucide-react';
import { api } from '../services/api';

const glassModalOverlay = {
  position: 'fixed',
  inset: 0,
  zIndex: 9999,
  background: 'rgba(2, 6, 23, 0.75)',
  backdropFilter: 'blur(8px)',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  padding: '16px',
};

const glassModalCard = {
  width: '100%',
  maxWidth: '480px',
  maxHeight: '85dvh',
  background: 'rgba(15, 23, 42, 0.96)',
  border: '1px solid rgba(148, 163, 184, 0.25)',
  borderRadius: '14px',
  boxShadow: '0 24px 60px rgba(0, 0, 0, 0.65)',
  color: '#f8fafc',
  display: 'flex',
  flexDirection: 'column',
  overflow: 'hidden',
};

const modalHeaderStyle = {
  padding: '14px 16px',
  borderBottom: '1px solid rgba(148, 163, 184, 0.18)',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  background: 'rgba(11, 17, 32, 0.9)',
};

const closeBtnStyle = {
  background: 'rgba(255, 255, 255, 0.08)',
  border: '1px solid rgba(255, 255, 255, 0.15)',
  color: '#e2e8f0',
  borderRadius: '8px',
  width: '32px',
  height: '32px',
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  cursor: 'pointer',
};

export function ThreadDrawer({ parentMessage, onClose, onSendThreadReply }) {
  const [loading, setLoading] = useState(true);
  const [parent, setParent] = useState(parentMessage);
  const [replies, setReplies] = useState([]);
  const [replyText, setReplyText] = useState('');
  const [sending, setSending] = useState(false);

  useEffect(() => {
    if (!parentMessage?._id) return;
    let active = true;
    setLoading(true);
    api.getChatThreadMessages(parentMessage._id)
      .then((res) => {
        if (!active) return;
        if (res?.parent) setParent(res.parent);
        if (Array.isArray(res?.replies)) setReplies(res.replies);
      })
      .catch(() => {})
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [parentMessage?._id]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    const txt = replyText.trim();
    if (!txt || sending) return;
    setSending(true);
    try {
      const sent = await onSendThreadReply(txt, parentMessage._id);
      if (sent) {
        setReplies((prev) => [...prev, sent]);
      } else {
        const res = await api.getChatThreadMessages(parentMessage._id);
        if (Array.isArray(res?.replies)) setReplies(res.replies);
      }
      setReplyText('');
    } finally {
      setSending(false);
    }
  };

  return (
    <div style={{ ...glassModalOverlay, justifyContent: 'flex-end', padding: 0 }} onClick={onClose}>
      <div
        className="erp-drawer"
        onClick={(e) => e.stopPropagation()}
        style={{
          width: 'min(420px, 100vw)',
          height: '100dvh',
          background: 'rgba(11, 17, 32, 0.98)',
          borderLeft: '1px solid rgba(148, 163, 184, 0.25)',
          display: 'flex',
          flexDirection: 'column',
          color: '#f8fafc',
        }}
      >
        <div style={modalHeaderStyle}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontWeight: 800 }}>
            <MessageSquare size={17} color="#38bdf8" />
            <span>Thread</span>
          </div>
          <button type="button" onClick={onClose} style={closeBtnStyle}><X size={16} /></button>
        </div>

        <div style={{ flex: 1, overflowY: 'auto', padding: '14px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
          <div style={{ padding: '12px', borderRadius: '10px', background: 'rgba(30, 41, 59, 0.75)', border: '1px solid rgba(56, 189, 248, 0.3)' }}>
            <div style={{ fontSize: '12px', fontWeight: 700, color: '#38bdf8', marginBottom: '4px' }}>
              {parent?.senderId?.name || parent?.senderName || 'User'}
            </div>
            <div style={{ fontSize: '13.5px', lineHeight: 1.45, whiteSpace: 'pre-wrap' }}>{parent?.content}</div>
          </div>

          <div style={{ fontSize: '11px', fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            {replies.length} {replies.length === 1 ? 'Reply' : 'Replies'}
          </div>

          {loading ? (
            <div style={{ color: '#94a3b8', fontSize: '13px', textAlign: 'center', padding: '20px' }}>Loading thread...</div>
          ) : replies.length === 0 ? (
            <div style={{ color: '#64748b', fontSize: '13px', textAlign: 'center', padding: '20px' }}>No replies in this thread yet.</div>
          ) : (
            replies.map((r) => (
              <div key={r._id} style={{ padding: '10px 12px', borderRadius: '10px', background: 'rgba(30, 41, 59, 0.5)', border: '1px solid rgba(148, 163, 184, 0.16)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '3px' }}>
                  <span style={{ fontSize: '12px', fontWeight: 700, color: '#e2e8f0' }}>{r.senderId?.name || r.senderName || 'Staff'}</span>
                  <span style={{ fontSize: '11px', color: '#64748b' }}>
                    {r.createdAt ? new Date(r.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : ''}
                  </span>
                </div>
                <div style={{ fontSize: '13px', color: '#cbd5e1', whiteSpace: 'pre-wrap' }}>{r.content}</div>
              </div>
            ))
          )}
        </div>

        <form onSubmit={handleSubmit} style={{ padding: '12px', borderTop: '1px solid rgba(148, 163, 184, 0.2)', display: 'flex', gap: '8px' }}>
          <input
            type="text"
            value={replyText}
            onChange={(e) => setReplyText(e.target.value)}
            placeholder="Reply in thread..."
            style={{
              flex: 1,
              background: 'rgba(30, 41, 59, 0.85)',
              border: '1px solid rgba(148, 163, 184, 0.25)',
              borderRadius: '8px',
              padding: '9px 12px',
              color: '#ffffff',
              fontSize: '13.5px',
            }}
          />
          <button
            type="submit"
            disabled={sending || !replyText.trim()}
            className="btn-primary"
            style={{
              background: '#2563eb',
              color: '#ffffff',
              border: 'none',
              borderRadius: '8px',
              padding: '0 14px',
              cursor: 'pointer',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
            }}
          >
            <Send size={15} />
          </button>
        </form>
      </div>
    </div>
  );
}

export function MessageInfoModal({ message, onClose }) {
  const [info, setInfo] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape' && onClose) onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  useEffect(() => {
    if (!message?._id) return;
    setLoading(true);
    api.getChatMessageInfo(message._id)
      .then((res) => setInfo(res?.data || null))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [message?._id]);

  return (
    <div style={glassModalOverlay} onClick={onClose}>
      <div style={glassModalCard} onClick={(e) => e.stopPropagation()}>
        <div style={modalHeaderStyle}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontWeight: 800 }}>
            <CheckCheck size={17} color="#38bdf8" />
            <span>Message Info</span>
          </div>
          <button type="button" onClick={onClose} style={closeBtnStyle}><X size={16} /></button>
        </div>

        <div style={{ padding: '16px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '14px' }}>
          <div style={{ padding: '10px 12px', borderRadius: '8px', background: 'rgba(30, 41, 59, 0.65)', fontSize: '13px', color: '#e2e8f0' }}>
            {message?.content}
          </div>
          {loading ? (
            <div style={{ color: '#94a3b8', fontSize: '13px', textAlign: 'center', padding: '16px' }}>Loading receipts...</div>
          ) : (
            <>
              <div>
                <div style={{ fontSize: '12px', fontWeight: 700, color: '#38bdf8', marginBottom: '6px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <CheckCheck size={14} /> Read By ({info?.readBy?.length || 0})
                </div>
                {(info?.readBy || []).length === 0 ? (
                  <div style={{ fontSize: '12.5px', color: '#64748b' }}>No read receipts yet</div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                    {info.readBy.map((u) => (
                      <div key={u._id} style={{ fontSize: '13px', padding: '6px 10px', borderRadius: '6px', background: 'rgba(255,255,255,0.04)' }}>
                        {u.name} <span style={{ color: '#64748b', fontSize: '11.5px' }}>({u.role || 'Staff'})</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div>
                <div style={{ fontSize: '12px', fontWeight: 700, color: '#94a3b8', marginBottom: '6px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <Check size={14} /> Delivered To ({info?.deliveredTo?.length || 0})
                </div>
                {(info?.deliveredTo || []).length === 0 ? (
                  <div style={{ fontSize: '12.5px', color: '#64748b' }}>Delivered to room</div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                    {info.deliveredTo.map((u) => (
                      <div key={u._id} style={{ fontSize: '13px', padding: '6px 10px', borderRadius: '6px', background: 'rgba(255,255,255,0.04)' }}>
                        {u.name}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

export function ScheduleMessageModal({ roomId, initialText = '', onClose, onScheduled }) {
  const defaultDt = new Date(Date.now() + 30 * 60000);
  const pad = (n) => String(n).padStart(2, '0');
  const defaultVal = `${defaultDt.getFullYear()}-${pad(defaultDt.getMonth() + 1)}-${pad(defaultDt.getDate())}T${pad(defaultDt.getHours())}:${pad(defaultDt.getMinutes())}`;

  const [content, setContent] = useState(initialText);
  const [scheduledAt, setScheduledAt] = useState(defaultVal);
  const [pendingList, setPendingList] = useState([]);
  const [saving, setSaving] = useState(false);
  const [errMsg, setErrMsg] = useState('');

  const loadPending = () => {
    if (!roomId) return;
    api.getScheduledChatMessages(roomId)
      .then((res) => { if (Array.isArray(res?.data)) setPendingList(res.data); })
      .catch(() => {});
  };

  useEffect(() => { loadPending(); }, [roomId]);

  const handleSchedule = async (e) => {
    e.preventDefault();
    if (!content.trim() || !scheduledAt) return;
    setSaving(true);
    setErrMsg('');
    try {
      const res = await api.scheduleChatMessage(roomId, content.trim(), new Date(scheduledAt).toISOString());
      if (res?.success) {
        setContent('');
        loadPending();
        if (onScheduled) onScheduled();
      } else {
        setErrMsg(res?.message || 'Failed to schedule message');
      }
    } catch (err) {
      setErrMsg(err?.message || 'Failed to schedule message');
    } finally {
      setSaving(false);
    }
  };

  const handleCancel = async (id) => {
    await api.cancelScheduledChatMessage(id).catch(() => {});
    loadPending();
  };

  return (
    <div style={glassModalOverlay} onClick={onClose}>
      <div style={glassModalCard} onClick={(e) => e.stopPropagation()}>
        <div style={modalHeaderStyle}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontWeight: 800 }}>
            <Clock size={17} color="#38bdf8" />
            <span>Schedule Message</span>
          </div>
          <button type="button" onClick={onClose} style={closeBtnStyle}><X size={16} /></button>
        </div>

        <form onSubmit={handleSchedule} style={{ padding: '16px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
          <textarea
            rows={3}
            value={content}
            onChange={(e) => setContent(e.target.value)}
            placeholder="Write message to send later..."
            style={{
              width: '100%',
              background: 'rgba(30, 41, 59, 0.85)',
              border: '1px solid rgba(148, 163, 184, 0.25)',
              borderRadius: '8px',
              padding: '10px',
              color: '#ffffff',
              fontSize: '13.5px',
            }}
          />
          <input
            type="datetime-local"
            value={scheduledAt}
            onChange={(e) => setScheduledAt(e.target.value)}
            style={{
              background: 'rgba(30, 41, 59, 0.85)',
              border: '1px solid rgba(148, 163, 184, 0.25)',
              borderRadius: '8px',
              padding: '9px 12px',
              color: '#ffffff',
              fontSize: '13.5px',
            }}
          />
          {errMsg && <div style={{ color: '#fca5a5', fontSize: '12px' }}>{errMsg}</div>}
          <button
            type="submit"
            disabled={saving || !content.trim()}
            className="btn-primary"
            style={{
              background: '#2563eb',
              color: '#ffffff',
              border: 'none',
              borderRadius: '8px',
              padding: '10px',
              fontWeight: 700,
              cursor: 'pointer',
            }}
          >
            {saving ? 'Scheduling...' : 'Schedule Message'}
          </button>
        </form>

        {pendingList.length > 0 && (
          <div style={{ padding: '0 16px 16px', borderTop: '1px solid rgba(148, 163, 184, 0.16)', maxHeight: '180px', overflowY: 'auto' }}>
            <div style={{ fontSize: '11.5px', fontWeight: 700, color: '#94a3b8', margin: '10px 0 6px' }}>
              Queued ({pendingList.length})
            </div>
            {pendingList.map((m) => (
              <div key={m._id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '8px', padding: '8px', borderRadius: '8px', background: 'rgba(30,41,59,0.5)', marginBottom: '6px' }}>
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontSize: '12.5px', color: '#f1f5f9', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{m.content}</div>
                  <div style={{ fontSize: '11px', color: '#38bdf8' }}>{new Date(m.scheduledAt).toLocaleString()}</div>
                </div>
                <button type="button" onClick={() => handleCancel(m._id)} style={{ ...closeBtnStyle, width: '28px', height: '28px', color: '#fca5a5' }}>
                  <Trash2 size={13} />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

export function StarredMessagesModal({ onClose, onJumpToRoom }) {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.getStarredChatMessages()
      .then((res) => { if (Array.isArray(res?.data)) setItems(res.data); })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const handleUnstar = async (id) => {
    await api.toggleStarChatMessage(id).catch(() => {});
    setItems((prev) => prev.filter((m) => m._id !== id));
  };

  return (
    <div style={glassModalOverlay} onClick={onClose}>
      <div style={glassModalCard} onClick={(e) => e.stopPropagation()}>
        <div style={modalHeaderStyle}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontWeight: 800 }}>
            <Star size={17} color="#fbbf24" />
            <span>Starred Messages</span>
          </div>
          <button type="button" onClick={onClose} style={closeBtnStyle}><X size={16} /></button>
        </div>

        <div style={{ padding: '14px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '8px' }}>
          {loading ? (
            <div style={{ color: '#94a3b8', textAlign: 'center', padding: '20px' }}>Loading starred messages...</div>
          ) : items.length === 0 ? (
            <div style={{ color: '#64748b', textAlign: 'center', padding: '24px', fontSize: '13px' }}>No starred messages yet.</div>
          ) : (
            items.map((m) => (
              <div key={m._id} style={{ padding: '10px 12px', borderRadius: '10px', background: 'rgba(30, 41, 59, 0.65)', border: '1px solid rgba(251, 191, 36, 0.22)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                  <span style={{ fontSize: '12px', fontWeight: 700, color: '#fbbf24' }}>
                    {m.senderId?.name || m.senderName} • {m.roomId?.name || 'Chat'}
                  </span>
                  <div style={{ display: 'flex', gap: '6px' }}>
                    {onJumpToRoom && m.roomId?._id && (
                      <button type="button" onClick={() => { onJumpToRoom(m.roomId._id); onClose(); }} style={{ ...closeBtnStyle, width: 'auto', padding: '0 8px', fontSize: '11px' }}>
                        Open
                      </button>
                    )}
                    <button type="button" onClick={() => handleUnstar(m._id)} style={{ ...closeBtnStyle, width: '26px', height: '26px', color: '#fbbf24' }}>
                      <Star size={13} fill="#fbbf24" />
                    </button>
                  </div>
                </div>
                <div style={{ fontSize: '13px', color: '#e2e8f0', whiteSpace: 'pre-wrap' }}>{m.content}</div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}

export function DisappearTimerModal({ roomId, currentSeconds = 0, onClose, onUpdated }) {
  const options = [
    { label: 'Off', value: 0 },
    { label: '24 Hours', value: 86400 },
    { label: '7 Days', value: 604800 },
    { label: '30 Days', value: 2592000 },
  ];

  const handleSelect = async (sec) => {
    await api.updateChatDisappearTimer(roomId, sec).catch(() => {});
    if (onUpdated) onUpdated(sec);
    onClose();
  };

  return (
    <div style={glassModalOverlay} onClick={onClose}>
      <div style={{ ...glassModalCard, maxWidth: '360px' }} onClick={(e) => e.stopPropagation()}>
        <div style={modalHeaderStyle}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontWeight: 800 }}>
            <Timer size={17} color="#38bdf8" />
            <span>Disappearing Messages</span>
          </div>
          <button type="button" onClick={onClose} style={closeBtnStyle}><X size={16} /></button>
        </div>
        <div style={{ padding: '14px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
          {options.map((opt) => {
            const active = Number(currentSeconds || 0) === opt.value;
            return (
              <button
                key={opt.value}
                type="button"
                onClick={() => handleSelect(opt.value)}
                style={{
                  padding: '10px 14px',
                  borderRadius: '8px',
                  background: active ? 'rgba(56, 189, 248, 0.18)' : 'rgba(30, 41, 59, 0.6)',
                  border: `1px solid ${active ? '#38bdf8' : 'rgba(148, 163, 184, 0.2)'}`,
                  color: active ? '#38bdf8' : '#e2e8f0',
                  fontWeight: 700,
                  textAlign: 'left',
                  cursor: 'pointer',
                }}
              >
                {opt.label}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}

const previewMemCache = new Map();
export function LinkPreviewCard({ text }) {
  const [preview, setPreview] = useState(null);
  const urlMatch = typeof text === 'string' ? text.match(/https?:\/\/[^\s<>"']+/i) : null;
  const targetUrl = urlMatch ? urlMatch[0] : '';

  useEffect(() => {
    if (!targetUrl) return;
    if (previewMemCache.has(targetUrl)) {
      setPreview(previewMemCache.get(targetUrl));
      return;
    }
    let active = true;
    api.getChatLinkPreview(targetUrl)
      .then((res) => {
        if (!active || !res?.success || !res?.data) return;
        previewMemCache.set(targetUrl, res.data);
        setPreview(res.data);
      })
      .catch(() => {});
    return () => { active = false; };
  }, [targetUrl]);

  if (!preview || !preview.title) return null;

  return (
    <a
      href={preview.url}
      target="_blank"
      rel="noopener noreferrer"
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: '4px',
        marginTop: '6px',
        padding: '8px 10px',
        borderRadius: '8px',
        background: 'rgba(15, 23, 42, 0.65)',
        border: '1px solid rgba(56, 189, 248, 0.25)',
        textDecoration: 'none',
        color: '#e2e8f0',
        maxWidth: '300px',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: '10.5px', color: '#38bdf8', fontWeight: 700 }}>
        <span>{preview.domain}</span>
        <ExternalLink size={11} />
      </div>
      <div style={{ fontSize: '12.5px', fontWeight: 700, color: '#ffffff' }}>{preview.title}</div>
      {preview.description && (
        <div style={{ fontSize: '11.5px', color: '#94a3b8', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
          {preview.description}
        </div>
      )}
    </a>
  );
}

export function BulkActionToolbar({ count, groups = [], onBulkDelete, onBulkForward, onCancel }) {
  const [forwardRoomId, setForwardRoomId] = useState('');
  if (count <= 0) return null;

  return (
    <div style={{
      position: 'sticky',
      bottom: '8px',
      zIndex: 40,
      margin: '0 12px',
      padding: '10px 14px',
      borderRadius: '12px',
      background: 'rgba(15, 23, 42, 0.96)',
      border: '1px solid rgba(56, 189, 248, 0.4)',
      boxShadow: '0 12px 32px rgba(0, 0, 0, 0.55)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: '10px',
      flexWrap: 'wrap',
    }}>
      <span style={{ fontSize: '13px', fontWeight: 800, color: '#38bdf8' }}>{count} selected</span>
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
        <select
          value={forwardRoomId}
          onChange={(e) => setForwardRoomId(e.target.value)}
          style={{
            background: 'rgba(30, 41, 59, 0.9)',
            color: '#f8fafc',
            border: '1px solid rgba(148, 163, 184, 0.3)',
            borderRadius: '6px',
            padding: '5px 8px',
            fontSize: '12px',
          }}
        >
          <option value="">Forward to...</option>
          {groups.map((g) => (
            <option key={g._id} value={g._id}>{g.name || 'Chat'}</option>
          ))}
        </select>
        <button
          type="button"
          disabled={!forwardRoomId}
          onClick={() => forwardRoomId && onBulkForward(forwardRoomId)}
          style={{ ...closeBtnStyle, width: 'auto', padding: '0 10px', gap: '4px', fontSize: '12px', color: '#38bdf8' }}
        >
          <Forward size={13} /> Forward
        </button>
        <button
          type="button"
          onClick={onBulkDelete}
          style={{ ...closeBtnStyle, width: 'auto', padding: '0 10px', gap: '4px', fontSize: '12px', color: '#fca5a5' }}
        >
          <Trash2 size={13} /> Delete
        </button>
        <button type="button" onClick={onCancel} style={{ ...closeBtnStyle, width: 'auto', padding: '0 10px', fontSize: '12px' }}>
          Cancel
        </button>
      </div>
    </div>
  );
}
