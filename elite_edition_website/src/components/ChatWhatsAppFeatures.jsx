import React, { useEffect, useState } from 'react';
import {
  X, Lock, Unlock, MapPin, UserPlus, Share2, Copy, Check, RefreshCw,
  Image as ImageIcon, Shield, HardDrive, Download, Radio, Eye, EyeOff,
  Phone, Mail, Building2, Navigation, Clock, Trash2, Video
} from 'lucide-react';
import api from '../services/api';

export const WALLPAPER_PRESETS = [
  { key: 'default', label: 'Default Dark', style: {} },
  {
    key: 'whatsapp-doodle',
    label: 'Midnight Slate',
    style: {
      backgroundColor: '#0b141a',
      backgroundImage: 'radial-gradient(rgba(255,255,255,0.04) 1px, transparent 0)',
      backgroundSize: '20px 20px',
    },
  },
  {
    key: 'emerald-night',
    label: 'Emerald Night',
    style: {
      background: 'linear-gradient(145deg, #062822 0%, #091d26 55%, #071318 100%)',
    },
  },
  {
    key: 'indigo-aurora',
    label: 'Indigo Aurora',
    style: {
      background: 'linear-gradient(135deg, #13112b 0%, #1c1942 50%, #0d1629 100%)',
    },
  },
  {
    key: 'warm-charcoal',
    label: 'Warm Charcoal',
    style: {
      background: 'linear-gradient(160deg, #1f1a18 0%, #161416 60%, #111318 100%)',
    },
  },
  {
    key: 'ocean-deep',
    label: 'Ocean Deep',
    style: {
      background: 'linear-gradient(160deg, #071e30 0%, #0a2a3d 50%, #061523 100%)',
    },
  },
];

export const getWallpaperStyle = (keyOrUrl) => {
  if (!keyOrUrl || keyOrUrl === 'default') return {};
  const preset = WALLPAPER_PRESETS.find((p) => p.key === keyOrUrl);
  if (preset) return preset.style;
  if (keyOrUrl.startsWith('http://') || keyOrUrl.startsWith('https://') || keyOrUrl.startsWith('data:')) {
    return {
      backgroundImage: `linear-gradient(rgba(10,14,22,0.72), rgba(10,14,22,0.72)), url("${keyOrUrl}")`,
      backgroundSize: 'cover',
      backgroundPosition: 'center',
    };
  }
  return {};
};

const modalBackdropStyle = {
  position: 'fixed',
  inset: 0,
  background: 'rgba(2, 6, 23, 0.78)',
  backdropFilter: 'blur(8px)',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  zIndex: 9999,
  padding: '1rem',
};

const modalCardStyle = {
  width: '100%',
  maxWidth: '460px',
  background: 'var(--bg-elevated, #0f172a)',
  border: '1px solid rgba(148,163,184,0.2)',
  borderRadius: '16px',
  padding: '1.25rem',
  color: 'var(--text-primary, #f8fafc)',
  boxShadow: '0 24px 60px rgba(0,0,0,0.5)',
  maxHeight: '88vh',
  overflowY: 'auto',
};

const inputStyle = {
  width: '100%',
  padding: '0.6rem 0.75rem',
  borderRadius: '10px',
  border: '1px solid rgba(148,163,184,0.25)',
  background: 'rgba(15, 23, 42, 0.65)',
  color: '#f8fafc',
  fontSize: '0.88rem',
  outline: 'none',
};

const primaryBtnStyle = {
  padding: '0.55rem 1rem',
  borderRadius: '10px',
  border: 'none',
  background: 'linear-gradient(135deg, #2563eb, #1d4ed8)',
  color: '#fff',
  fontWeight: 600,
  fontSize: '0.86rem',
  cursor: 'pointer',
  display: 'inline-flex',
  alignItems: 'center',
  gap: '0.4rem',
};

/* 1. Chat Lock PIN Modal */
export const ChatLockModal = ({ mode = 'unlock', roomName, onClose, onConfirm, onRemoveLock }) => {
  const [pin, setPin] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!/^\d{4,6}$/.test(pin.trim())) {
      setError('Enter a 4 to 6 digit numeric PIN');
      return;
    }
    setBusy(true);
    setError('');
    try {
      await onConfirm(pin.trim());
    } catch (err) {
      setError(err?.message || 'Incorrect PIN');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div style={modalBackdropStyle} onClick={onClose}>
      <div style={modalCardStyle} onClick={(e) => e.stopPropagation()}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.9rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontWeight: 700, fontSize: '1rem' }}>
            {mode === 'unlock' ? <Lock size={18} color="#f59e0b" /> : <Shield size={18} color="#3b82f6" />}
            {mode === 'unlock' ? `Unlock "${roomName}"` : `Lock "${roomName}"`}
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: '#94a3b8', cursor: 'pointer' }}><X size={18} /></button>
        </div>
        <p style={{ fontSize: '0.84rem', color: '#94a3b8', marginBottom: '0.9rem' }}>
          {mode === 'unlock'
            ? 'This conversation is PIN-protected. Enter your 4–6 digit PIN to open it.'
            : 'Set a 4–6 digit PIN to lock this chat. Only you will need this PIN to open it.'}
        </p>
        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
          <input
            type="password"
            inputMode="numeric"
            maxLength={6}
            autoFocus
            value={pin}
            onChange={(e) => setPin(e.target.value.replace(/\D/g, ''))}
            placeholder="Enter 4–6 digit PIN"
            style={{ ...inputStyle, textAlign: 'center', fontSize: '1.25rem', letterSpacing: '0.4rem' }}
          />
          {error && <div style={{ color: '#f87171', fontSize: '0.82rem' }}>{error}</div>}
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: '0.5rem', marginTop: '0.25rem' }}>
            {mode === 'manage' && onRemoveLock ? (
              <button
                type="button"
                onClick={onRemoveLock}
                style={{ ...primaryBtnStyle, background: 'rgba(239,68,68,0.18)', color: '#f87171', border: '1px solid rgba(239,68,68,0.35)' }}
              >
                <Unlock size={15} /> Remove Lock
              </button>
            ) : <span />}
            <div style={{ display: 'flex', gap: '0.5rem' }}>
              <button type="button" onClick={onClose} style={{ ...primaryBtnStyle, background: 'rgba(148,163,184,0.15)' }}>Cancel</button>
              <button type="submit" disabled={busy} style={primaryBtnStyle}>
                {busy ? 'Checking...' : (mode === 'unlock' ? 'Unlock Chat' : 'Lock Chat')}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
};

/* 2. Wallpaper Picker Modal */
export const WallpaperPickerModal = ({ currentWallpaper, scopeLabel, onSelect, onClose }) => {
  const [customUrl, setCustomUrl] = useState(
    currentWallpaper && !WALLPAPER_PRESETS.some((p) => p.key === currentWallpaper) ? currentWallpaper : ''
  );

  return (
    <div style={modalBackdropStyle} onClick={onClose}>
      <div style={modalCardStyle} onClick={(e) => e.stopPropagation()}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.9rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontWeight: 700 }}>
            <ImageIcon size={18} color="#38bdf8" /> Chat Wallpaper ({scopeLabel})
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: '#94a3b8', cursor: 'pointer' }}><X size={18} /></button>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '0.65rem', marginBottom: '1rem' }}>
          {WALLPAPER_PRESETS.map((preset) => {
            const active = currentWallpaper === preset.key || (!currentWallpaper && preset.key === 'default');
            return (
              <button
                key={preset.key}
                type="button"
                onClick={() => onSelect(preset.key)}
                style={{
                  height: '76px',
                  borderRadius: '12px',
                  border: active ? '2px solid #3b82f6' : '1px solid rgba(148,163,184,0.2)',
                  ...preset.style,
                  backgroundColor: preset.style.backgroundColor || '#0f172a',
                  color: '#e2e8f0',
                  fontSize: '0.75rem',
                  fontWeight: 600,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'flex-end',
                  justifyContent: 'center',
                  padding: '0.4rem',
                }}
              >
                {preset.label}
              </button>
            );
          })}
        </div>
        <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
          <input
            type="url"
            value={customUrl}
            onChange={(e) => setCustomUrl(e.target.value)}
            placeholder="Or paste custom image URL..."
            style={inputStyle}
          />
          <button
            type="button"
            disabled={!customUrl.trim()}
            onClick={() => onSelect(customUrl.trim())}
            style={primaryBtnStyle}
          >
            Apply
          </button>
        </div>
      </div>
    </div>
  );
};

/* 3. Location Sharing Modal */
export const LocationShareModal = ({ onSendLocation, onClose }) => {
  const [lat, setLat] = useState('');
  const [lng, setLng] = useState('');
  const [label, setLabel] = useState('Current Location');
  const [address, setAddress] = useState('');
  const [isLive, setIsLive] = useState(false);
  const [liveMinutes, setLiveMinutes] = useState(60);
  const [locating, setLocating] = useState(false);
  const [geoErr, setGeoErr] = useState('');

  const detectGPS = () => {
    if (!navigator.geolocation) {
      setGeoErr('Geolocation is not supported in this browser.');
      return;
    }
    setLocating(true);
    setGeoErr('');
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setLat(pos.coords.latitude.toFixed(6));
        setLng(pos.coords.longitude.toFixed(6));
        setLocating(false);
      },
      (err) => {
        setGeoErr(err.message || 'Unable to fetch GPS location. You can enter coordinates or address manually.');
        setLocating(false);
      },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  };

  useEffect(() => {
    detectGPS();
  }, []);

  const handleSubmit = (e) => {
    e.preventDefault();
    const numLat = parseFloat(lat);
    const numLng = parseFloat(lng);
    if (Number.isNaN(numLat) || Number.isNaN(numLng)) {
      setGeoErr('Please detect GPS or enter valid Latitude & Longitude.');
      return;
    }
    onSendLocation({
      lat: numLat,
      lng: numLng,
      label: label.trim() || 'Shared Location',
      address: address.trim(),
      isLive,
      liveExpiresAt: isLive ? new Date(Date.now() + liveMinutes * 60000).toISOString() : null,
    });
  };

  return (
    <div style={modalBackdropStyle} onClick={onClose}>
      <div style={modalCardStyle} onClick={(e) => e.stopPropagation()}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.9rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontWeight: 700 }}>
            <MapPin size={18} color="#22c55e" /> Share Location
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: '#94a3b8', cursor: 'pointer' }}><X size={18} /></button>
        </div>
        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '0.7rem' }}>
          <button type="button" onClick={detectGPS} disabled={locating} style={{ ...primaryBtnStyle, justifyContent: 'center', background: 'rgba(34,197,94,0.18)', color: '#4ade80', border: '1px solid rgba(34,197,94,0.35)' }}>
            <Navigation size={15} /> {locating ? 'Detecting GPS...' : 'Use My Current GPS Location'}
          </button>
          {geoErr && <div style={{ color: '#fbbf24', fontSize: '0.78rem' }}>{geoErr}</div>}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem' }}>
            <input value={lat} onChange={(e) => setLat(e.target.value)} placeholder="Latitude (e.g. 21.1702)" style={inputStyle} />
            <input value={lng} onChange={(e) => setLng(e.target.value)} placeholder="Longitude (e.g. 72.8311)" style={inputStyle} />
          </div>
          <input value={label} onChange={(e) => setLabel(e.target.value)} placeholder="Location Label (e.g. Factory Gate 2)" style={inputStyle} />
          <input value={address} onChange={(e) => setAddress(e.target.value)} placeholder="Address / Landmark (optional)" style={inputStyle} />
          <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.85rem', cursor: 'pointer' }}>
            <input type="checkbox" checked={isLive} onChange={(e) => setIsLive(e.target.checked)} />
            Share Live Location
            {isLive && (
              <select value={liveMinutes} onChange={(e) => setLiveMinutes(Number(e.target.value))} style={{ ...inputStyle, width: 'auto', padding: '0.25rem 0.5rem', marginLeft: 'auto' }}>
                <option value={15}>15 mins</option>
                <option value={60}>1 hour</option>
                <option value={480}>8 hours</option>
              </select>
            )}
          </label>
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem', marginTop: '0.3rem' }}>
            <button type="button" onClick={onClose} style={{ ...primaryBtnStyle, background: 'rgba(148,163,184,0.15)' }}>Cancel</button>
            <button type="submit" style={primaryBtnStyle}>Send Location</button>
          </div>
        </form>
      </div>
    </div>
  );
};

/* 4. Contact Card (vCard) Sharing Modal */
export const ContactShareModal = ({ allUsers = [], onSendContact, onClose }) => {
  const [search, setSearch] = useState('');
  const [customMode, setCustomMode] = useState(false);
  const [custom, setCustom] = useState({ name: '', phone: '', email: '', company: '', role: '' });

  const filtered = allUsers.filter((u) =>
    `${u.name || ''} ${u.email || ''} ${u.role || ''} ${u.phone || ''}`.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div style={modalBackdropStyle} onClick={onClose}>
      <div style={modalCardStyle} onClick={(e) => e.stopPropagation()}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.9rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontWeight: 700 }}>
            <UserPlus size={18} color="#a78bfa" /> Share Contact Card
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: '#94a3b8', cursor: 'pointer' }}><X size={18} /></button>
        </div>
        <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '0.8rem' }}>
          <button type="button" onClick={() => setCustomMode(false)} style={{ ...primaryBtnStyle, flex: 1, justifyContent: 'center', background: !customMode ? '#2563eb' : 'rgba(148,163,184,0.15)' }}>Team Directory</button>
          <button type="button" onClick={() => setCustomMode(true)} style={{ ...primaryBtnStyle, flex: 1, justifyContent: 'center', background: customMode ? '#2563eb' : 'rgba(148,163,184,0.15)' }}>Custom Contact</button>
        </div>

        {!customMode ? (
          <>
            <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search team member..." style={{ ...inputStyle, marginBottom: '0.65rem' }} />
            <div style={{ maxHeight: '260px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
              {filtered.slice(0, 30).map((u) => (
                <button
                  key={u._id}
                  type="button"
                  onClick={() => onSendContact({
                    userId: String(u._id),
                    name: u.name || u.username || 'Team Member',
                    phone: u.phone || u.mobile || '',
                    email: u.email || '',
                    company: (u.allowedCompanies && u.allowedCompanies[0]) || 'Elite Edition',
                    role: u.role || '',
                  })}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '0.55rem 0.7rem',
                    borderRadius: '10px',
                    border: '1px solid rgba(148,163,184,0.15)',
                    background: 'rgba(15,23,42,0.5)',
                    color: '#f8fafc',
                    cursor: 'pointer',
                    textAlign: 'left',
                  }}
                >
                  <div>
                    <div style={{ fontWeight: 600, fontSize: '0.86rem' }}>{u.name || u.username}</div>
                    <div style={{ fontSize: '0.75rem', color: '#94a3b8' }}>{u.role || 'Staff'} {u.email ? `• ${u.email}` : ''}</div>
                  </div>
                  <Share2 size={15} color="#60a5fa" />
                </button>
              ))}
            </div>
          </>
        ) : (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              if (!custom.name.trim()) return;
              onSendContact(custom);
            }}
            style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}
          >
            <input required value={custom.name} onChange={(e) => setCustom({ ...custom, name: e.target.value })} placeholder="Full Name *" style={inputStyle} />
            <input value={custom.phone} onChange={(e) => setCustom({ ...custom, phone: e.target.value })} placeholder="Phone Number" style={inputStyle} />
            <input value={custom.email} onChange={(e) => setCustom({ ...custom, email: e.target.value })} placeholder="Email Address" style={inputStyle} />
            <input value={custom.company} onChange={(e) => setCustom({ ...custom, company: e.target.value })} placeholder="Company / Party Name" style={inputStyle} />
            <input value={custom.role} onChange={(e) => setCustom({ ...custom, role: e.target.value })} placeholder="Role / Designation" style={inputStyle} />
            <button type="submit" style={{ ...primaryBtnStyle, justifyContent: 'center' }}>Send Contact Card</button>
          </form>
        )}
      </div>
    </div>
  );
};

/* 5. Group Invite Link & Join Requests Modal */
export const GroupInviteModal = ({ group, onJoined, onClose }) => {
  const [info, setInfo] = useState(null);
  const [copied, setCopied] = useState(false);
  const [joinTokenInput, setJoinTokenInput] = useState('');
  const [statusMsg, setStatusMsg] = useState('');

  const loadInfo = async () => {
    if (!group?._id) return;
    const res = await api.getGroupInviteInfo(group._id);
    if (res?.success) setInfo(res.data);
  };

  useEffect(() => {
    loadInfo();
  }, [group?._id]);

  const inviteUrl = info?.inviteToken
    ? `${window.location.origin}/?chatInvite=${info.inviteToken}`
    : '';

  const copyLink = () => {
    if (!inviteUrl) return;
    navigator.clipboard?.writeText(inviteUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 1800);
  };

  const handleReset = async () => {
    const res = await api.resetGroupInviteLink(group._id);
    if (res?.success) setInfo((prev) => ({ ...prev, inviteToken: res.data.inviteToken }));
  };

  const handleToggleApproval = async () => {
    const next = !info?.requireJoinApproval;
    const res = await api.updateGroupInviteSettings(group._id, next);
    if (res?.success) setInfo((prev) => ({ ...prev, requireJoinApproval: res.data.requireJoinApproval }));
  };

  const handleRequestAction = async (targetUserId, action) => {
    const res = await api.handleGroupJoinRequest(group._id, targetUserId, action);
    if (res?.success) loadInfo();
  };

  const handleJoinByToken = async (e) => {
    e.preventDefault();
    const raw = joinTokenInput.trim();
    const token = raw.includes('chatInvite=') ? raw.split('chatInvite=').pop().split('&')[0] : raw;
    if (!token) return;
    const res = await api.joinGroupByInviteToken(token);
    if (res?.success) {
      setStatusMsg(res.status === 'pending_approval' ? `Join request sent for "${res.roomName}"` : `Joined "${res.roomName}"!`);
      setJoinTokenInput('');
      if (res.status === 'joined' && onJoined) onJoined();
    } else {
      setStatusMsg(res?.message || 'Invalid invite link');
    }
  };

  return (
    <div style={modalBackdropStyle} onClick={onClose}>
      <div style={modalCardStyle} onClick={(e) => e.stopPropagation()}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.9rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontWeight: 700 }}>
            <Share2 size={18} color="#38bdf8" /> Group Invite Link
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: '#94a3b8', cursor: 'pointer' }}><X size={18} /></button>
        </div>

        {group && group.type === 'group' && info && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', marginBottom: '1rem' }}>
            <div style={{ fontSize: '0.82rem', color: '#94a3b8' }}>Share this link so team members can join <strong>{group.name}</strong>:</div>
            <div style={{ display: 'flex', gap: '0.4rem' }}>
              <input readOnly value={inviteUrl} style={{ ...inputStyle, fontSize: '0.78rem' }} />
              <button type="button" onClick={copyLink} style={primaryBtnStyle}>
                {copied ? <Check size={15} /> : <Copy size={15} />} {copied ? 'Copied' : 'Copy'}
              </button>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: '0.45rem', fontSize: '0.83rem', cursor: 'pointer' }}>
                <input type="checkbox" checked={Boolean(info.requireJoinApproval)} onChange={handleToggleApproval} />
                Require Admin Approval to Join
              </label>
              <button type="button" onClick={handleReset} style={{ background: 'none', border: 'none', color: '#f87171', fontSize: '0.8rem', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: '0.25rem' }}>
                <RefreshCw size={13} /> Reset Link
              </button>
            </div>

            {info.joinRequests?.length > 0 && (
              <div style={{ borderTop: '1px solid rgba(148,163,184,0.18)', paddingTop: '0.65rem' }}>
                <div style={{ fontSize: '0.8rem', fontWeight: 700, marginBottom: '0.4rem', color: '#fbbf24' }}>
                  Pending Join Requests ({info.joinRequests.length})
                </div>
                {info.joinRequests.map((req) => (
                  <div key={req.userId?._id || req.userId} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.4rem 0', fontSize: '0.83rem' }}>
                    <span>{req.userId?.name || 'User'}</span>
                    <div style={{ display: 'flex', gap: '0.35rem' }}>
                      <button type="button" onClick={() => handleRequestAction(req.userId?._id || req.userId, 'approve')} style={{ ...primaryBtnStyle, padding: '0.25rem 0.55rem', fontSize: '0.75rem', background: '#16a34a' }}>Approve</button>
                      <button type="button" onClick={() => handleRequestAction(req.userId?._id || req.userId, 'reject')} style={{ ...primaryBtnStyle, padding: '0.25rem 0.55rem', fontSize: '0.75rem', background: '#dc2626' }}>Reject</button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        <form onSubmit={handleJoinByToken} style={{ borderTop: '1px solid rgba(148,163,184,0.18)', paddingTop: '0.85rem', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
          <div style={{ fontSize: '0.8rem', fontWeight: 600, color: '#cbd5e1' }}>Join Another Group via Invite Link / Token</div>
          <div style={{ display: 'flex', gap: '0.4rem' }}>
            <input value={joinTokenInput} onChange={(e) => setJoinTokenInput(e.target.value)} placeholder="Paste invite URL or token..." style={inputStyle} />
            <button type="submit" style={primaryBtnStyle}>Join</button>
          </div>
          {statusMsg && <div style={{ fontSize: '0.8rem', color: '#4ade80' }}>{statusMsg}</div>}
        </form>
      </div>
    </div>
  );
};

/* 6. Broadcast List Creation Modal */
export const BroadcastListModal = ({ allUsers = [], currentUserId, onCreated, onClose }) => {
  const [name, setName] = useState('');
  const [selectedIds, setSelectedIds] = useState([]);
  const [busy, setBusy] = useState(false);

  const toggleUser = (id) => {
    setSelectedIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  };

  const handleCreate = async (e) => {
    e.preventDefault();
    if (!name.trim() || selectedIds.length === 0) return;
    setBusy(true);
    try {
      const res = await api.createCommunicationGroup({
        name: name.trim(),
        type: 'broadcast',
        description: `Broadcast list (${selectedIds.length} recipients)`,
        memberIds: selectedIds,
      });
      if (res?.success) {
        onCreated(res.data);
        onClose();
      }
    } finally {
      setBusy(false);
    }
  };

  return (
    <div style={modalBackdropStyle} onClick={onClose}>
      <div style={modalCardStyle} onClick={(e) => e.stopPropagation()}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.85rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontWeight: 700 }}>
            <Radio size={18} color="#f59e0b" /> New Broadcast List
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: '#94a3b8', cursor: 'pointer' }}><X size={18} /></button>
        </div>
        <p style={{ fontSize: '0.8rem', color: '#94a3b8', marginBottom: '0.75rem' }}>
          Messages sent in a Broadcast List are delivered privately as individual DMs to each selected recipient.
        </p>
        <form onSubmit={handleCreate} style={{ display: 'flex', flexDirection: 'column', gap: '0.7rem' }}>
          <input required value={name} onChange={(e) => setName(e.target.value)} placeholder="Broadcast List Name (e.g. Sales Team Updates)" style={inputStyle} />
          <div style={{ maxHeight: '220px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
            {allUsers
              .filter((u) => String(u._id) !== String(currentUserId))
              .map((u) => {
                const checked = selectedIds.includes(String(u._id));
                return (
                  <label key={u._id} style={{ display: 'flex', alignItems: 'center', gap: '0.55rem', padding: '0.45rem 0.6rem', borderRadius: '8px', background: checked ? 'rgba(37,99,235,0.2)' : 'rgba(15,23,42,0.45)', cursor: 'pointer', fontSize: '0.85rem' }}>
                    <input type="checkbox" checked={checked} onChange={() => toggleUser(String(u._id))} />
                    <span>{u.name || u.username}</span>
                    <span style={{ marginLeft: 'auto', fontSize: '0.74rem', color: '#94a3b8' }}>{u.role}</span>
                  </label>
                );
              })}
          </div>
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem' }}>
            <button type="button" onClick={onClose} style={{ ...primaryBtnStyle, background: 'rgba(148,163,184,0.15)' }}>Cancel</button>
            <button type="submit" disabled={busy || selectedIds.length === 0} style={primaryBtnStyle}>
              {busy ? 'Creating...' : `Create (${selectedIds.length})`}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

/* 7. Chat Settings Modal (Privacy + Auto-Download + Storage Manager) */
export const ChatSettingsModal = ({ prefs, onUpdatePrefs, onClose }) => {
  const [tab, setTab] = useState('privacy');
  const [storage, setStorage] = useState(null);
  const [cacheCleared, setCacheCleared] = useState(false);

  useEffect(() => {
    if (tab === 'storage' && !storage) {
      api.getChatStorageUsage().then((res) => {
        if (res?.success) setStorage(res.data);
      });
    }
  }, [tab]);

  const privacy = prefs?.privacy || { lastSeen: 'everyone', readReceipts: true, onlineVisible: true };
  const autoDl = prefs?.mediaAutoDownload || { photos: true, videos: false, documents: true, audio: true };

  const formatBytes = (b = 0) => {
    if (b < 1024) return `${b} B`;
    if (b < 1024 * 1024) return `${(b / 1024).toFixed(1)} KB`;
    return `${(b / (1024 * 1024)).toFixed(2)} MB`;
  };

  return (
    <div style={modalBackdropStyle} onClick={onClose}>
      <div style={{ ...modalCardStyle, maxWidth: '500px' }} onClick={(e) => e.stopPropagation()}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.85rem' }}>
          <div style={{ fontWeight: 700, fontSize: '1rem' }}>WhatsApp-Style Chat Settings</div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: '#94a3b8', cursor: 'pointer' }}><X size={18} /></button>
        </div>
        <div style={{ display: 'flex', gap: '0.4rem', marginBottom: '1rem' }}>
          {[
            { id: 'privacy', label: 'Privacy', icon: <Shield size={14} /> },
            { id: 'autodownload', label: 'Auto-Download', icon: <Download size={14} /> },
            { id: 'storage', label: 'Storage', icon: <HardDrive size={14} /> },
          ].map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => setTab(t.id)}
              style={{
                ...primaryBtnStyle,
                flex: 1,
                justifyContent: 'center',
                background: tab === t.id ? '#2563eb' : 'rgba(148,163,184,0.14)',
              }}
            >
              {t.icon} {t.label}
            </button>
          ))}
        </div>

        {tab === 'privacy' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.8rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <div style={{ fontWeight: 600, fontSize: '0.88rem' }}>Last Seen</div>
                <div style={{ fontSize: '0.76rem', color: '#94a3b8' }}>Who can see your last seen timestamp</div>
              </div>
              <select
                value={privacy.lastSeen}
                onChange={(e) => onUpdatePrefs({ privacy: { ...privacy, lastSeen: e.target.value } })}
                style={{ ...inputStyle, width: 'auto' }}
              >
                <option value="everyone">Everyone</option>
                <option value="nobody">Nobody</option>
              </select>
            </div>
            <label style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'pointer' }}>
              <div>
                <div style={{ fontWeight: 600, fontSize: '0.88rem' }}>Read Receipts (Blue Ticks)</div>
                <div style={{ fontSize: '0.76rem', color: '#94a3b8' }}>If turned off, you won't send read receipts</div>
              </div>
              <input
                type="checkbox"
                checked={privacy.readReceipts !== false}
                onChange={(e) => onUpdatePrefs({ privacy: { ...privacy, readReceipts: e.target.checked } })}
              />
            </label>
            <label style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'pointer' }}>
              <div>
                <div style={{ fontWeight: 600, fontSize: '0.88rem' }}>Show Online Status</div>
                <div style={{ fontSize: '0.76rem', color: '#94a3b8' }}>Display green dot when you are active</div>
              </div>
              <input
                type="checkbox"
                checked={privacy.onlineVisible !== false}
                onChange={(e) => onUpdatePrefs({ privacy: { ...privacy, onlineVisible: e.target.checked } })}
              />
            </label>
          </div>
        )}

        {tab === 'autodownload' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            {[
              { key: 'photos', label: 'Photos & Images' },
              { key: 'audio', label: 'Voice Notes & Audio' },
              { key: 'documents', label: 'Documents & PDFs' },
              { key: 'videos', label: 'Videos & Video Notes' },
            ].map((item) => (
              <label key={item.key} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'pointer', padding: '0.4rem 0' }}>
                <span style={{ fontWeight: 600, fontSize: '0.88rem' }}>{item.label}</span>
                <input
                  type="checkbox"
                  checked={Boolean(autoDl[item.key])}
                  onChange={(e) => onUpdatePrefs({ mediaAutoDownload: { ...autoDl, [item.key]: e.target.checked } })}
                />
              </label>
            ))}
          </div>
        )}

        {tab === 'storage' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            <div style={{ padding: '0.75rem', borderRadius: '12px', background: 'rgba(30,41,59,0.65)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <div style={{ fontSize: '0.78rem', color: '#94a3b8' }}>Total Shared Media</div>
                <div style={{ fontSize: '1.15rem', fontWeight: 700 }}>{storage ? formatBytes(storage.totalBytes) : 'Calculating...'}</div>
              </div>
              <div style={{ textAlign: 'right' }}>
                <div style={{ fontSize: '0.78rem', color: '#94a3b8' }}>Files</div>
                <div style={{ fontSize: '1.15rem', fontWeight: 700 }}>{storage ? storage.totalFiles : '—'}</div>
              </div>
            </div>
            <div style={{ maxHeight: '190px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
              {(storage?.breakdown || []).map((row) => (
                <div key={row.roomId} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.83rem', padding: '0.4rem 0.55rem', borderRadius: '8px', background: 'rgba(15,23,42,0.45)' }}>
                  <span>{row.roomName}</span>
                  <span style={{ color: '#94a3b8' }}>{row.fileCount} files • {formatBytes(row.totalBytes)}</span>
                </div>
              ))}
            </div>
            <button
              type="button"
              onClick={() => {
                Object.keys(localStorage).forEach((k) => {
                  if (k.startsWith('chat_media_cache_')) localStorage.removeItem(k);
                });
                setCacheCleared(true);
              }}
              style={{ ...primaryBtnStyle, justifyContent: 'center', background: 'rgba(239,68,68,0.2)', color: '#f87171', border: '1px solid rgba(239,68,68,0.35)' }}
            >
              <Trash2 size={15} /> {cacheCleared ? 'Local Media Cache Cleared!' : 'Clear Local Chat Media Cache'}
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

/* 8. View-Once Lightbox Viewer */
export const ViewOnceViewerModal = ({ message, onClose }) => {
  if (!message?.attachment?.fileUrl) return null;
  const isVideo = (message.attachment.fileType || '').includes('video') || (message.attachment.mimeType || '').startsWith('video/');
  return (
    <div style={modalBackdropStyle} onClick={onClose}>
      <div style={{ ...modalCardStyle, maxWidth: '640px', textAlign: 'center' }} onClick={(e) => e.stopPropagation()}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
          <span style={{ fontSize: '0.85rem', fontWeight: 700, color: '#38bdf8', display: 'inline-flex', alignItems: 'center', gap: '0.4rem' }}>
            <Eye size={16} /> View-Once Media (Disappears after closing)
          </span>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: '#94a3b8', cursor: 'pointer' }}><X size={18} /></button>
        </div>
        {isVideo ? (
          <video src={message.attachment.fileUrl} controls autoPlay style={{ maxWidth: '100%', maxHeight: '65vh', borderRadius: '12px' }} />
        ) : (
          <img src={message.attachment.fileUrl} alt="View once" style={{ maxWidth: '100%', maxHeight: '65vh', borderRadius: '12px', objectFit: 'contain' }} />
        )}
      </div>
    </div>
  );
};

/* 9. Inline Message Bubble Renderers for View-Once, Location, Contact & Video Note */
export const LocationBubbleCard = ({ locationMeta }) => {
  if (!locationMeta) return null;
  const lat = Number(locationMeta.lat || 0);
  const lng = Number(locationMeta.lng || 0);
  const hasCoords = Number.isFinite(lat) && Number.isFinite(lng) && (lat !== 0 || lng !== 0);
  const mapUrl = `https://www.google.com/maps?q=${lat},${lng}`;
  const delta = 0.006;
  const osmEmbedUrl = hasCoords
    ? `https://www.openstreetmap.org/export/embed.html?bbox=${(lng - delta).toFixed(5)},${(lat - delta).toFixed(5)},${(lng + delta).toFixed(5)},${(lat + delta).toFixed(5)}&layer=mapnik&marker=${lat.toFixed(5)},${lng.toFixed(5)}`
    : null;
  const isLiveActive = locationMeta.isLive && (!locationMeta.liveExpiresAt || new Date(locationMeta.liveExpiresAt) > new Date());
  return (
    <a
      href={mapUrl}
      target="_blank"
      rel="noreferrer"
      className="no-glass-override phoenix-location-card"
      style={{
        display: 'block',
        textDecoration: 'none',
        color: '#0f172a',
        background: '#ffffff',
        border: '1px solid rgba(148, 163, 184, 0.35)',
        borderRadius: '12px',
        overflow: 'hidden',
        minWidth: '250px',
        maxWidth: '300px',
        boxShadow: '0 4px 14px rgba(15, 23, 42, 0.14)',
      }}
    >
      {/* WhatsApp-style Map Preview */}
      <div
        style={{
          position: 'relative',
          height: '132px',
          width: '100%',
          background: 'linear-gradient(135deg, #dbeafe 0%, #e0f2fe 50%, #dcfce7 100%)',
          overflow: 'hidden',
        }}
      >
        {osmEmbedUrl ? (
          <iframe
            title={locationMeta.label || 'Location Map'}
            src={osmEmbedUrl}
            style={{
              width: '100%',
              height: '100%',
              border: 'none',
              pointerEvents: 'none',
              display: 'block',
            }}
            loading="lazy"
          />
        ) : (
          <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#0369a1' }}>
            <MapPin size={32} />
          </div>
        )}
        {isLiveActive && (
          <div
            style={{
              position: 'absolute',
              top: '8px',
              left: '8px',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '5px',
              padding: '3px 8px',
              borderRadius: '999px',
              background: '#16a34a',
              color: '#ffffff',
              fontSize: '0.68rem',
              fontWeight: 800,
              boxShadow: '0 2px 6px rgba(0,0,0,0.25)',
            }}
          >
            <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#bbf7d0' }} />
            LIVE
          </div>
        )}
      </div>

      {/* Info Footer */}
      <div style={{ padding: '0.6rem 0.75rem', background: '#ffffff' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontWeight: 700, fontSize: '0.86rem', color: '#0f172a' }}>
          <MapPin size={15} color="#16a34a" style={{ flexShrink: 0 }} />
          <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {locationMeta.label || 'Shared Location'}
          </span>
        </div>
        {locationMeta.address && (
          <div style={{ fontSize: '0.75rem', color: '#475569', marginTop: '0.2rem', lineHeight: 1.35 }}>
            {locationMeta.address}
          </div>
        )}
        <div
          style={{
            fontSize: '0.74rem',
            color: '#2563eb',
            fontWeight: 700,
            marginTop: '0.35rem',
            paddingTop: '0.35rem',
            borderTop: '1px solid #e2e8f0',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '0.35rem',
          }}
        >
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', color: '#64748b', fontWeight: 600 }}>
            <Clock size={12} /> {isLiveActive ? 'Live Location' : `${lat.toFixed(4)}, ${lng.toFixed(4)}`}
          </span>
          <span>Open Map →</span>
        </div>
      </div>
    </a>
  );
};

export const ContactBubbleCard = ({ contactMeta, onStartDM }) => {
  if (!contactMeta) return null;
  const downloadVcf = () => {
    const vcf = [
      'BEGIN:VCARD',
      'VERSION:3.0',
      `FN:${contactMeta.name || ''}`,
      contactMeta.company ? `ORG:${contactMeta.company}` : '',
      contactMeta.role ? `TITLE:${contactMeta.role}` : '',
      contactMeta.phone ? `TEL:${contactMeta.phone}` : '',
      contactMeta.email ? `EMAIL:${contactMeta.email}` : '',
      'END:VCARD',
    ].filter(Boolean).join('\n');
    const blob = new Blob([vcf], { type: 'text/vcard' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `${(contactMeta.name || 'contact').replace(/\s+/g, '_')}.vcf`;
    a.click();
  };

  return (
    <div style={{ background: 'rgba(15, 23, 42, 0.55)', border: '1px solid rgba(167, 139, 250, 0.35)', borderRadius: '12px', padding: '0.65rem 0.8rem', minWidth: '220px' }}>
      <div style={{ fontWeight: 700, fontSize: '0.9rem', color: '#e9d5ff' }}>{contactMeta.name}</div>
      {(contactMeta.role || contactMeta.company) && (
        <div style={{ fontSize: '0.76rem', color: '#94a3b8', display: 'flex', alignItems: 'center', gap: '0.3rem', marginTop: '0.15rem' }}>
          <Building2 size={12} /> {[contactMeta.role, contactMeta.company].filter(Boolean).join(' • ')}
        </div>
      )}
      {contactMeta.phone && (
        <div style={{ fontSize: '0.78rem', color: '#cbd5e1', display: 'flex', alignItems: 'center', gap: '0.3rem', marginTop: '0.2rem' }}>
          <Phone size={12} /> {contactMeta.phone}
        </div>
      )}
      {contactMeta.email && (
        <div style={{ fontSize: '0.78rem', color: '#cbd5e1', display: 'flex', alignItems: 'center', gap: '0.3rem', marginTop: '0.15rem' }}>
          <Mail size={12} /> {contactMeta.email}
        </div>
      )}
      <div style={{ display: 'flex', gap: '0.4rem', marginTop: '0.5rem' }}>
        {contactMeta.userId && onStartDM && (
          <button type="button" onClick={() => onStartDM(contactMeta.userId)} style={{ ...primaryBtnStyle, padding: '0.3rem 0.6rem', fontSize: '0.74rem' }}>Message</button>
        )}
        <button type="button" onClick={downloadVcf} style={{ ...primaryBtnStyle, padding: '0.3rem 0.6rem', fontSize: '0.74rem', background: 'rgba(148,163,184,0.2)' }}>Save .vcf</button>
      </div>
    </div>
  );
};

export const ViewOnceBubbleCard = ({ message, currentUserId, onOpen }) => {
  const alreadyOpened = (message.viewedBy || []).some((v) => String(v.userId) === String(currentUserId));
  const isSender = String(message.senderId?._id || message.senderId) === String(currentUserId);
  return (
    <button
      type="button"
      disabled={alreadyOpened && !isSender}
      onClick={() => onOpen(message)}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: '0.45rem',
        padding: '0.5rem 0.85rem',
        borderRadius: '999px',
        border: '1px solid rgba(56,189,248,0.4)',
        background: alreadyOpened ? 'rgba(148,163,184,0.12)' : 'rgba(56,189,248,0.16)',
        color: alreadyOpened ? '#94a3b8' : '#38bdf8',
        fontWeight: 600,
        fontSize: '0.83rem',
        cursor: alreadyOpened && !isSender ? 'default' : 'pointer',
      }}
    >
      {alreadyOpened ? <EyeOff size={15} /> : <Eye size={15} />}
      {alreadyOpened ? 'Opened' : (isSender ? 'View-Once Media Sent' : 'Tap to View Once')}
    </button>
  );
};

export const VideoNoteBubble = ({ fileUrl }) => {
  if (!fileUrl) return null;
  return (
    <div style={{ display: 'inline-flex', flexDirection: 'column', alignItems: 'center', gap: '0.25rem' }}>
      <video
        src={fileUrl}
        controls
        playsInline
        style={{
          width: '190px',
          height: '190px',
          borderRadius: '50%',
          objectFit: 'cover',
          border: '3px solid rgba(56, 189, 248, 0.65)',
          boxShadow: '0 8px 24px rgba(0,0,0,0.35)',
        }}
      />
      <span style={{ fontSize: '0.7rem', color: '#94a3b8', display: 'inline-flex', alignItems: 'center', gap: '0.25rem' }}>
        <Video size={11} /> Instant Video Note
      </span>
    </div>
  );
};
