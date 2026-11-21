import React, { useEffect, useRef, useState } from 'react';
import {
  X, ShieldCheck, Lock, Layers, Calendar, PhoneCall, Video, Volume2,
  Sparkles, RotateCw, Type, PenTool, Check, MapPin, Users, Copy,
  Bell, Clock, Trash2, Maximize2, Mic, MicOff, PhoneOff
} from 'lucide-react';
import api from '../services/api';

/* ── WebCrypto AES-GCM Room E2EE Helpers ── */
async function deriveRoomAesKey(roomId) {
  const enc = new TextEncoder();
  const keyMaterial = await window.crypto.subtle.importKey(
    'raw',
    enc.encode(`elite-e2ee-v1:${String(roomId)}`),
    { name: 'PBKDF2' },
    false,
    ['deriveKey']
  );
  return window.crypto.subtle.deriveKey(
    { name: 'PBKDF2', salt: enc.encode('elite-chat-salt'), iterations: 10000, hash: 'SHA-256' },
    keyMaterial,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt']
  );
}

export async function encryptRoomMessage(plainText, roomId) {
  if (!window.crypto?.subtle) return null;
  const iv = window.crypto.getRandomValues(new Uint8Array(12));
  const key = await deriveRoomAesKey(roomId);
  const cipherBuf = await window.crypto.subtle.encrypt(
    { name: 'AES-GCM', iv },
    key,
    new TextEncoder().encode(plainText)
  );
  const toB64 = (buf) => btoa(String.fromCharCode(...new Uint8Array(buf)));
  return { iv: toB64(iv), ciphertext: toB64(cipherBuf) };
}

export async function decryptRoomMessage(encryptedPayload, roomId) {
  if (!encryptedPayload?.iv || !encryptedPayload?.ciphertext || !window.crypto?.subtle) return null;
  try {
    const fromB64 = (b64) => Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
    const key = await deriveRoomAesKey(roomId);
    const plainBuf = await window.crypto.subtle.decrypt(
      { name: 'AES-GCM', iv: fromB64(encryptedPayload.iv) },
      key,
      fromB64(encryptedPayload.ciphertext)
    );
    return new TextDecoder().decode(plainBuf);
  } catch {
    return null;
  }
}

/* ── Custom Per-Chat Web Audio Tone Synthesizer (56 Free Built-in Tones) ── */
export const CHAT_TONES = [
  { key: 'default', label: 'Default Pop', freqs: [520, 680], type: 'sine', step: 0.08, dur: 0.16, vol: 0.08 },
  { key: 'chime', label: 'Crystal Chime', freqs: [880, 1175], type: 'sine', step: 0.08, dur: 0.18, vol: 0.08 },
  { key: 'bell', label: 'Soft Bell', freqs: [660, 990], type: 'sine', step: 0.09, dur: 0.22, vol: 0.08 },
  { key: 'pulse', label: 'Digital Pulse', freqs: [440, 554, 659], type: 'triangle', step: 0.07, dur: 0.15, vol: 0.08 },
  { key: 'aurora', label: 'Aurora Harp', freqs: [523, 659, 784, 1047], type: 'sine', step: 0.065, dur: 0.20, vol: 0.075 },
  { key: 'droplet', label: 'Water Droplet', freqs: [740, 1109], type: 'sine', step: 0.055, dur: 0.13, vol: 0.085 },
  { key: 'marimba', label: 'Warm Marimba', freqs: [392, 523, 659], type: 'triangle', step: 0.08, dur: 0.18, vol: 0.09 },
  { key: 'chord', label: 'Glass Chord', freqs: [587, 740, 880], type: 'sine', step: 0.04, dur: 0.24, vol: 0.07 },
  { key: 'ping', label: 'Sonar Ping', freqs: [1047, 1319], type: 'sine', step: 0.09, dur: 0.20, vol: 0.07 },
  { key: 'sparkle', label: 'Sparkle Rising', freqs: [659, 784, 988, 1319], type: 'sine', step: 0.055, dur: 0.16, vol: 0.07 },
  { key: 'knock', label: 'Soft Knock', freqs: [260, 330], type: 'triangle', step: 0.07, dur: 0.11, vol: 0.10 },
  { key: 'whistle', label: 'Airy Whistle', freqs: [988, 1175, 1397], type: 'sine', step: 0.075, dur: 0.17, vol: 0.065 },
  { key: 'cosmic', label: 'Cosmic Synth', freqs: [330, 494, 659, 988], type: 'triangle', step: 0.07, dur: 0.22, vol: 0.075 },
  { key: 'retro', label: 'Retro Arcade', freqs: [523, 659, 784], type: 'square', step: 0.065, dur: 0.12, vol: 0.035 },
  { key: 'alert', label: 'Urgent Double', freqs: [880, 880, 1175], type: 'triangle', step: 0.09, dur: 0.14, vol: 0.085 },
  { key: 'zen', label: 'Zen Bowl', freqs: [432, 648], type: 'sine', step: 0.11, dur: 0.32, vol: 0.085 },
  { key: 'breeze', label: 'Morning Breeze', freqs: [587, 659, 784, 988], type: 'sine', step: 0.07, dur: 0.19, vol: 0.07 },
  { key: 'bubble', label: 'Bubble Pop', freqs: [480, 720, 960], type: 'sine', step: 0.045, dur: 0.10, vol: 0.08 },
  { key: 'kalimba', label: 'Kalimba Pluck', freqs: [523, 784, 659], type: 'triangle', step: 0.08, dur: 0.20, vol: 0.085 },
  { key: 'xylophone', label: 'Bright Xylophone', freqs: [1047, 1319, 1568], type: 'sine', step: 0.06, dur: 0.14, vol: 0.07 },
  { key: 'bamboo', label: 'Bamboo Flute', freqs: [587, 880, 784], type: 'sine', step: 0.09, dur: 0.22, vol: 0.075 },
  { key: 'velvet', label: 'Velvet Ding', freqs: [494, 740], type: 'sine', step: 0.07, dur: 0.24, vol: 0.085 },
  { key: 'prism', label: 'Prism Cascade', freqs: [659, 880, 1175, 1480], type: 'sine', step: 0.05, dur: 0.17, vol: 0.065 },
  { key: 'glimmer', label: 'Starlight Glimmer', freqs: [988, 1319, 1568], type: 'sine', step: 0.07, dur: 0.18, vol: 0.065 },
  { key: 'pebble', label: 'River Pebble', freqs: [392, 587], type: 'sine', step: 0.06, dur: 0.14, vol: 0.09 },
  { key: 'cascade', label: 'Silver Cascade', freqs: [1175, 988, 784, 659], type: 'sine', step: 0.06, dur: 0.16, vol: 0.07 },
  { key: 'echo', label: 'Canyon Echo', freqs: [659, 659, 494], type: 'sine', step: 0.10, dur: 0.22, vol: 0.075 },
  { key: 'sunrise', label: 'Sunrise Chime', freqs: [440, 554, 659, 880], type: 'sine', step: 0.075, dur: 0.21, vol: 0.075 },
  { key: 'twilight', label: 'Twilight Pad', freqs: [349, 440, 523], type: 'sine', step: 0.09, dur: 0.28, vol: 0.08 },
  { key: 'meadow', label: 'Meadow Bird', freqs: [1175, 1397, 1175, 1568], type: 'sine', step: 0.055, dur: 0.12, vol: 0.06 },
  { key: 'cricket', label: 'Night Cricket', freqs: [1319, 1568, 1319], type: 'triangle', step: 0.05, dur: 0.09, vol: 0.055 },
  { key: 'rain', label: 'Raindrop Trio', freqs: [880, 1047, 1319], type: 'sine', step: 0.05, dur: 0.12, vol: 0.07 },
  { key: 'cyber', label: 'Cyber Beep', freqs: [660, 880, 1320], type: 'square', step: 0.05, dur: 0.09, vol: 0.03 },
  { key: 'matrix', label: 'Matrix Blip', freqs: [784, 523, 1047], type: 'sawtooth', step: 0.055, dur: 0.10, vol: 0.03 },
  { key: 'laser', label: 'Laser Zip', freqs: [1480, 988, 659], type: 'triangle', step: 0.04, dur: 0.11, vol: 0.07 },
  { key: 'coin', label: 'Arcade Coin', freqs: [988, 1319], type: 'square', step: 0.07, dur: 0.15, vol: 0.035 },
  { key: 'powerup', label: 'Level Up', freqs: [440, 554, 659, 880, 1109], type: 'triangle', step: 0.055, dur: 0.14, vol: 0.07 },
  { key: 'notify_pro', label: 'Executive Tone', freqs: [523, 659, 784], type: 'sine', step: 0.06, dur: 0.18, vol: 0.08 },
  { key: 'slack_pop', label: 'Crisp Double Tap', freqs: [622, 932], type: 'triangle', step: 0.07, dur: 0.12, vol: 0.08 },
  { key: 'teams_ping', label: 'Office Ping', freqs: [587, 880, 1175], type: 'sine', step: 0.065, dur: 0.16, vol: 0.075 },
  { key: 'dispatch', label: 'Dispatch Horn', freqs: [523, 523, 784], type: 'triangle', step: 0.08, dur: 0.15, vol: 0.085 },
  { key: 'beacon', label: 'Beacon Signal', freqs: [740, 988, 740], type: 'sine', step: 0.08, dur: 0.18, vol: 0.075 },
  { key: 'temple', label: 'Temple Bell', freqs: [528, 792, 1056], type: 'sine', step: 0.10, dur: 0.34, vol: 0.075 },
  { key: 'lotus', label: 'Lotus Bloom', freqs: [396, 528, 660], type: 'sine', step: 0.095, dur: 0.28, vol: 0.08 },
  { key: 'sapphire', label: 'Sapphire Note', freqs: [784, 1175], type: 'sine', step: 0.075, dur: 0.20, vol: 0.075 },
  { key: 'emerald', label: 'Emerald Drop', freqs: [659, 988], type: 'sine', step: 0.075, dur: 0.20, vol: 0.075 },
  { key: 'ruby', label: 'Ruby Chord', freqs: [494, 622, 740], type: 'triangle', step: 0.06, dur: 0.20, vol: 0.075 },
  { key: 'amber', label: 'Amber Glow', freqs: [440, 659, 880], type: 'sine', step: 0.08, dur: 0.22, vol: 0.075 },
  { key: 'quartz', label: 'Quartz Tick', freqs: [1245, 1568], type: 'sine', step: 0.045, dur: 0.09, vol: 0.065 },
  { key: 'piano_up', label: 'Soft Piano Up', freqs: [523, 587, 659, 784], type: 'triangle', step: 0.07, dur: 0.18, vol: 0.075 },
  { key: 'piano_down', label: 'Soft Piano Down', freqs: [784, 659, 587, 523], type: 'triangle', step: 0.07, dur: 0.18, vol: 0.075 },
  { key: 'harp_gliss', label: 'Harp Glissando', freqs: [440, 523, 659, 784, 988], type: 'sine', step: 0.045, dur: 0.18, vol: 0.065 },
  { key: 'orbit', label: 'Orbit Pulse', freqs: [330, 440, 660, 880], type: 'sine', step: 0.07, dur: 0.19, vol: 0.075 },
  { key: 'whisper', label: 'Gentle Whisper', freqs: [587, 740], type: 'sine', step: 0.09, dur: 0.20, vol: 0.055 },
  { key: 'confirm', label: 'Success Chime', freqs: [523, 659, 1047], type: 'sine', step: 0.06, dur: 0.18, vol: 0.08 },
  { key: 'silent', label: 'Silent (No Sound)', freqs: [] },
];

export function playRoomNotificationTone(toneKey = 'default') {
  const tone = CHAT_TONES.find((t) => t.key === toneKey) || CHAT_TONES[0];
  if (!tone || tone.freqs.length === 0) return;
  try {
    const AudioCtx = window.AudioContext || window.webkitAudioContext;
    if (!AudioCtx) return;
    const ctx = new AudioCtx();
    const t = ctx.currentTime;
    const step = tone.step || 0.08;
    const dur = tone.dur || 0.16;
    const vol = tone.vol || 0.08;
    const oscType = tone.type || 'sine';
    tone.freqs.forEach((f, idx) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = oscType;
      osc.frequency.setValueAtTime(f, t + idx * step);
      gain.gain.setValueAtTime(vol, t + idx * step);
      gain.gain.exponentialRampToValueAtTime(0.001, t + idx * step + dur);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(t + idx * step);
      osc.stop(t + idx * step + dur + 0.01);
    });
  } catch {}
}

const backdrop = {
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

const card = {
  width: '100%',
  maxWidth: '480px',
  background: '#0f172a',
  border: '1px solid rgba(148,163,184,0.22)',
  borderRadius: '16px',
  padding: '1.25rem',
  color: '#f8fafc',
  boxShadow: '0 24px 60px rgba(0,0,0,0.5)',
  maxHeight: '88vh',
  overflowY: 'auto',
};

const inp = {
  width: '100%',
  padding: '0.55rem 0.75rem',
  borderRadius: '10px',
  border: '1px solid rgba(148,163,184,0.25)',
  background: 'rgba(15, 23, 42, 0.7)',
  color: '#f8fafc',
  fontSize: '0.86rem',
  outline: 'none',
};

const btn = {
  padding: '0.55rem 1rem',
  borderRadius: '10px',
  border: 'none',
  background: 'linear-gradient(135deg, #2563eb, #1d4ed8)',
  color: '#fff',
  fontWeight: 600,
  fontSize: '0.84rem',
  cursor: 'pointer',
  display: 'inline-flex',
  alignItems: 'center',
  gap: '0.4rem',
};

/* 1. E2EE Security Code & Toggle Modal */
export const E2EEVerifyModal = ({ group, onUpdated, onClose }) => {
  const [enabled, setEnabled] = useState(group?.e2eeEnabled !== false);
  const [safetyNumbers, setSafetyNumbers] = useState('');
  const [busy, setBusy] = useState(false);

  const syncE2EE = async (nextState) => {
    setBusy(true);
    try {
      const res = await api.toggleRoomE2EE(group._id, nextState);
      if (res?.success) {
        setEnabled(res.e2eeEnabled);
        setSafetyNumbers(res.safetyNumbers || '');
        if (onUpdated) onUpdated(res.e2eeEnabled);
      }
    } finally {
      setBusy(false);
    }
  };

  useEffect(() => {
    syncE2EE(group?.e2eeEnabled !== false);
  }, [group?._id]);

  return (
    <div style={backdrop} onClick={onClose}>
      <div style={card} onClick={(e) => e.stopPropagation()}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.9rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontWeight: 700 }}>
            <ShieldCheck size={18} color="#22c55e" /> End-to-End Encryption (E2EE)
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: '#94a3b8', cursor: 'pointer' }}><X size={18} /></button>
        </div>
        <p style={{ fontSize: '0.82rem', color: '#94a3b8', marginBottom: '0.85rem' }}>
          When enabled, messages in <strong>{group?.name}</strong> are encrypted client-side with WebCrypto AES-GCM before leaving your device.
        </p>
        <div style={{ padding: '0.85rem', borderRadius: '12px', background: 'rgba(30,41,59,0.65)', marginBottom: '0.9rem' }}>
          <div style={{ fontSize: '0.74rem', color: '#94a3b8', marginBottom: '0.35rem', fontWeight: 700 }}>SECURITY VERIFICATION CODE</div>
          <div style={{ fontFamily: 'monospace', fontSize: '0.95rem', letterSpacing: '0.1rem', color: '#4ade80', wordBreak: 'break-word' }}>
            {safetyNumbers || 'Calculating safety fingerprint...'}
          </div>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ fontSize: '0.85rem', fontWeight: 600 }}>
            Status: <strong style={{ color: enabled ? '#4ade80' : '#94a3b8' }}>{enabled ? 'Encrypted (AES-GCM)' : 'Standard'}</strong>
          </span>
          <button type="button" disabled={busy} onClick={() => syncE2EE(!enabled)} style={{ ...btn, background: enabled ? '#dc2626' : '#16a34a' }}>
            <Lock size={14} /> {enabled ? 'Disable E2EE' : 'Enable E2EE'}
          </button>
        </div>
      </div>
    </div>
  );
};

/* 2. Communities Hub & Creation Modal */
export const CommunityModal = ({ groups = [], onSelectRoom, onCreated, onClose }) => {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [selectedSubIds, setSelectedSubIds] = useState([]);
  const [busy, setBusy] = useState(false);

  const communities = groups.filter((g) => g.type === 'community');
  const eligibleGroups = groups.filter((g) => g.type === 'group' && !g.isAnnouncementChannel);

  const handleCreate = async (e) => {
    e.preventDefault();
    if (!name.trim()) return;
    setBusy(true);
    try {
      const res = await api.createChatCommunity({ name: name.trim(), description: description.trim(), subGroupIds: selectedSubIds });
      if (res?.success) {
        setName('');
        setDescription('');
        setSelectedSubIds([]);
        if (onCreated) onCreated();
      }
    } finally {
      setBusy(false);
    }
  };

  return (
    <div style={backdrop} onClick={onClose}>
      <div style={{ ...card, maxWidth: '520px' }} onClick={(e) => e.stopPropagation()}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.9rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontWeight: 700 }}>
            <Layers size={18} color="#38bdf8" /> Communities &amp; Sub-Channels
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: '#94a3b8', cursor: 'pointer' }}><X size={18} /></button>
        </div>

        {communities.length > 0 && (
          <div style={{ marginBottom: '1rem', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            <div style={{ fontSize: '0.78rem', fontWeight: 700, color: '#94a3b8' }}>YOUR COMMUNITIES</div>
            {communities.map((c) => {
              const subs = groups.filter((g) => String(g.communityId) === String(c._id));
              return (
                <div key={c._id} style={{ padding: '0.7rem', borderRadius: '12px', background: 'rgba(30,41,59,0.55)', border: '1px solid rgba(56,189,248,0.25)' }}>
                  <div style={{ fontWeight: 700, fontSize: '0.9rem', color: '#38bdf8' }}>{c.name}</div>
                  {c.description && <div style={{ fontSize: '0.76rem', color: '#94a3b8' }}>{c.description}</div>}
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.35rem', marginTop: '0.45rem' }}>
                    {subs.map((s) => (
                      <button
                        key={s._id}
                        type="button"
                        onClick={() => { onSelectRoom(s); onClose(); }}
                        style={{ padding: '0.25rem 0.55rem', borderRadius: '999px', border: '1px solid rgba(148,163,184,0.25)', background: s.isAnnouncementChannel ? 'rgba(245,158,11,0.18)' : 'rgba(15,23,42,0.7)', color: s.isAnnouncementChannel ? '#fbbf24' : '#e2e8f0', fontSize: '0.74rem', cursor: 'pointer' }}
                      >
                        {s.isAnnouncementChannel ? '📢 ' : '# '}{s.name}
                      </button>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        <form onSubmit={handleCreate} style={{ display: 'flex', flexDirection: 'column', gap: '0.65rem', borderTop: '1px solid rgba(148,163,184,0.18)', paddingTop: '0.85rem' }}>
          <div style={{ fontSize: '0.8rem', fontWeight: 700 }}>Create New Community</div>
          <input required value={name} onChange={(e) => setName(e.target.value)} placeholder="Community Name (e.g. Production Hub)" style={inp} />
          <input value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Description (optional)" style={inp} />
          <div style={{ maxHeight: '140px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '0.3rem' }}>
            {eligibleGroups.map((g) => {
              const checked = selectedSubIds.includes(String(g._id));
              return (
                <label key={g._id} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.82rem', cursor: 'pointer', padding: '0.3rem 0.45rem', borderRadius: '6px', background: checked ? 'rgba(37,99,235,0.2)' : 'transparent' }}>
                  <input type="checkbox" checked={checked} onChange={() => setSelectedSubIds((p) => checked ? p.filter((x) => x !== String(g._id)) : [...p, String(g._id)])} />
                  <span>{g.name}</span>
                </label>
              );
            })}
          </div>
          <button type="submit" disabled={busy} style={{ ...btn, justifyContent: 'center' }}>
            {busy ? 'Creating...' : 'Create Community + Announcement Channel'}
          </button>
        </form>
      </div>
    </div>
  );
};

/* 3. Group Event Modal + Interactive RSVP Bubble */
export const GroupEventModal = ({ onCreateEvent, onClose }) => {
  const [title, setTitle] = useState('');
  const [eventDate, setEventDate] = useState('');
  const [location, setLocation] = useState('');
  const [description, setDescription] = useState('');

  return (
    <div style={backdrop} onClick={onClose}>
      <div style={card} onClick={(e) => e.stopPropagation()}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.9rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontWeight: 700 }}>
            <Calendar size={18} color="#f59e0b" /> Create Group Event
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: '#94a3b8', cursor: 'pointer' }}><X size={18} /></button>
        </div>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (!title.trim() || !eventDate) return;
            onCreateEvent({ title: title.trim(), eventDate, location: location.trim(), description: description.trim(), rsvps: [] });
          }}
          style={{ display: 'flex', flexDirection: 'column', gap: '0.65rem' }}
        >
          <input required value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Event Title (e.g. Monthly Production Review) *" style={inp} />
          <input required type="datetime-local" value={eventDate} onChange={(e) => setEventDate(e.target.value)} style={inp} />
          <input value={location} onChange={(e) => setLocation(e.target.value)} placeholder="Location or Meeting Room (optional)" style={inp} />
          <textarea rows={2} value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Agenda / Notes (optional)" style={inp} />
          <button type="submit" style={{ ...btn, justifyContent: 'center' }}>Send Event Invite</button>
        </form>
      </div>
    </div>
  );
};

export const EventBubbleCard = ({ message, currentUserId, onRsvp }) => {
  const ev = message.eventMeta;
  if (!ev) return null;
  const rsvps = ev.rsvps || [];
  const myStatus = rsvps.find((r) => String(r.userId?._id || r.userId) === String(currentUserId))?.status;
  const goingCount = rsvps.filter((r) => r.status === 'going').length;
  const maybeCount = rsvps.filter((r) => r.status === 'maybe').length;

  return (
    <div style={{ background: 'rgba(15,23,42,0.6)', border: '1px solid rgba(245,158,11,0.38)', borderRadius: '12px', padding: '0.7rem 0.85rem', minWidth: '235px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontWeight: 800, color: '#fbbf24', fontSize: '0.9rem' }}>
        <Calendar size={15} /> {ev.title}
      </div>
      {ev.eventDate && <div style={{ fontSize: '0.76rem', color: '#e2e8f0', marginTop: '0.2rem' }}>{new Date(ev.eventDate).toLocaleString()}</div>}
      {ev.location && <div style={{ fontSize: '0.74rem', color: '#94a3b8', display: 'flex', alignItems: 'center', gap: '0.25rem', marginTop: '0.15rem' }}><MapPin size={11} /> {ev.location}</div>}
      {ev.description && <div style={{ fontSize: '0.76rem', color: '#cbd5e1', marginTop: '0.3rem' }}>{ev.description}</div>}
      <div style={{ fontSize: '0.72rem', color: '#94a3b8', marginTop: '0.4rem', display: 'flex', gap: '0.6rem' }}>
        <span><Users size={11} style={{ verticalAlign: 'middle' }} /> {goingCount} Going</span>
        <span>{maybeCount} Maybe</span>
      </div>
      <div style={{ display: 'flex', gap: '0.35rem', marginTop: '0.5rem' }}>
        {[
          { id: 'going', label: 'Going' },
          { id: 'maybe', label: 'Maybe' },
          { id: 'not_going', label: "Can't Go" },
        ].map((opt) => (
          <button
            key={opt.id}
            type="button"
            onClick={() => onRsvp(message._id, opt.id)}
            style={{
              flex: 1,
              padding: '0.3rem 0.4rem',
              borderRadius: '8px',
              border: myStatus === opt.id ? '1.5px solid #38bdf8' : '1px solid rgba(148,163,184,0.25)',
              background: myStatus === opt.id ? 'rgba(56,189,248,0.22)' : 'rgba(255,255,255,0.05)',
              color: myStatus === opt.id ? '#38bdf8' : '#e2e8f0',
              fontSize: '0.72rem',
              fontWeight: 700,
              cursor: 'pointer',
            }}
          >
            {opt.label}
          </button>
        ))}
      </div>
    </div>
  );
};

/* 4. Shareable Call Link Modal + Bubble */
export const CallLinkModal = ({ groupId, onCreated, onClose }) => {
  const [callType, setCallType] = useState('video');
  const [title, setTitle] = useState('Quick Team Sync');
  const [busy, setBusy] = useState(false);

  const handleGenerate = async (e) => {
    e.preventDefault();
    setBusy(true);
    try {
      const res = await api.createChatCallLink(groupId, { callType, title: title.trim() || 'Team Call' });
      if (res?.success && res.data) {
        onCreated(res.data);
        onClose();
      }
    } finally {
      setBusy(false);
    }
  };

  return (
    <div style={backdrop} onClick={onClose}>
      <div style={card} onClick={(e) => e.stopPropagation()}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.9rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontWeight: 700 }}>
            <PhoneCall size={18} color="#22c55e" /> Create Shareable Call Link
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: '#94a3b8', cursor: 'pointer' }}><X size={18} /></button>
        </div>
        <form onSubmit={handleGenerate} style={{ display: 'flex', flexDirection: 'column', gap: '0.7rem' }}>
          <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Call Title" style={inp} />
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            <button type="button" onClick={() => setCallType('video')} style={{ ...btn, flex: 1, justifyContent: 'center', background: callType === 'video' ? '#2563eb' : 'rgba(148,163,184,0.15)' }}><Video size={15} /> Video Call</button>
            <button type="button" onClick={() => setCallType('voice')} style={{ ...btn, flex: 1, justifyContent: 'center', background: callType === 'voice' ? '#2563eb' : 'rgba(148,163,184,0.15)' }}><PhoneCall size={15} /> Voice Call</button>
          </div>
          <button type="submit" disabled={busy} style={{ ...btn, justifyContent: 'center', background: '#16a34a' }}>{busy ? 'Generating...' : 'Send Call Link to Chat'}</button>
        </form>
      </div>
    </div>
  );
};

export const CallLinkBubbleCard = ({ callLinkMeta, onJoin }) => {
  const [copied, setCopied] = useState(false);
  if (!callLinkMeta) return null;
  const url = `${window.location.origin}/?joinCall=${callLinkMeta.token}`;
  return (
    <div style={{ background: 'rgba(15,23,42,0.6)', border: '1px solid rgba(34,197,94,0.38)', borderRadius: '12px', padding: '0.65rem 0.85rem', minWidth: '220px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem', fontWeight: 800, color: '#4ade80', fontSize: '0.88rem' }}>
        {callLinkMeta.callType === 'voice' ? <PhoneCall size={15} /> : <Video size={15} />}
        {callLinkMeta.title || 'Team Call Link'}
      </div>
      <div style={{ fontSize: '0.73rem', color: '#94a3b8', marginTop: '0.2rem' }}>Created by {callLinkMeta.createdByName || 'Team'}</div>
      <div style={{ display: 'flex', gap: '0.4rem', marginTop: '0.5rem' }}>
        <button type="button" onClick={() => onJoin(callLinkMeta)} style={{ ...btn, padding: '0.32rem 0.7rem', fontSize: '0.76rem', background: '#16a34a' }}>Join Call</button>
        <button
          type="button"
          onClick={() => { navigator.clipboard?.writeText(url); setCopied(true); setTimeout(() => setCopied(false), 1500); }}
          style={{ ...btn, padding: '0.32rem 0.65rem', fontSize: '0.76rem', background: 'rgba(148,163,184,0.2)' }}
        >
          {copied ? <Check size={13} /> : <Copy size={13} />} {copied ? 'Copied' : 'Copy Link'}
        </button>
      </div>
    </div>
  );
};

/* 5. Custom Per-Chat Notification Tone Modal */
export const CustomToneModal = ({ roomName, currentTone = 'default', onSelectTone, onClose }) => {
  const [selected, setSelected] = useState(currentTone);
  const [toneQuery, setToneQuery] = useState('');
  const filteredTones = CHAT_TONES.filter((t) =>
    t.label.toLowerCase().includes(toneQuery.trim().toLowerCase())
  );
  return (
    <div style={backdrop} onClick={onClose}>
      <div style={card} onClick={(e) => e.stopPropagation()}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontWeight: 700 }}>
            <Volume2 size={18} color="#38bdf8" /> Notification Tone ({roomName})
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: '#94a3b8', cursor: 'pointer' }}><X size={18} /></button>
        </div>
        <input
          type="text"
          value={toneQuery}
          onChange={(e) => setToneQuery(e.target.value)}
          placeholder={`Search ${CHAT_TONES.length} free notification tones...`}
          style={{ ...inp, marginBottom: '0.65rem', fontSize: '0.82rem' }}
        />
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.45rem', marginBottom: '1rem', maxHeight: '50vh', overflowY: 'auto', paddingRight: '4px' }}>
          {filteredTones.map((t) => (
            <button
              key={t.key}
              type="button"
              onClick={() => { setSelected(t.key); playRoomNotificationTone(t.key); }}
              style={{
                display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                padding: '0.6rem 0.8rem', borderRadius: '10px', cursor: 'pointer',
                border: selected === t.key ? '1.5px solid #38bdf8' : '1px solid rgba(148,163,184,0.2)',
                background: selected === t.key ? 'rgba(56,189,248,0.18)' : 'rgba(15,23,42,0.55)',
                color: '#f8fafc', fontSize: '0.85rem', fontWeight: 600,
              }}
            >
              <span>{t.label}</span>
              {selected === t.key && <Check size={16} color="#38bdf8" />}
            </button>
          ))}
        </div>
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem' }}>
          <button type="button" onClick={onClose} style={{ ...btn, background: 'rgba(148,163,184,0.15)' }}>Cancel</button>
          <button type="button" onClick={() => onSelectTone(selected)} style={btn}>Save Tone</button>
        </div>
      </div>
    </div>
  );
};

/* 6. Built-in Image Markup, Rotate & HD/Standard Quality Modal */
export const ImageMarkupModal = ({ file, isHdInitial = false, onConfirm, onClose }) => {
  const canvasRef = useRef(null);
  const [drawColor, setDrawColor] = useState('#ef4444');
  const [drawing, setDrawing] = useState(false);
  const [isHd, setIsHd] = useState(isHdInitial);
  const [rotation, setRotation] = useState(0);
  const [textNote, setTextNote] = useState('');
  const imgRef = useRef(null);

  const renderBaseImage = (deg = rotation) => {
    const canvas = canvasRef.current;
    const img = imgRef.current;
    if (!canvas || !img) return;
    const ctx = canvas.getContext('2d');
    const maxDim = isHd ? 1600 : 900;
    const scale = Math.min(1, maxDim / Math.max(img.width, img.height));
    const w = Math.round(img.width * scale);
    const h = Math.round(img.height * scale);
    const swap = deg % 180 !== 0;
    canvas.width = swap ? h : w;
    canvas.height = swap ? w : h;
    ctx.save();
    ctx.translate(canvas.width / 2, canvas.height / 2);
    ctx.rotate((deg * Math.PI) / 180);
    ctx.drawImage(img, -w / 2, -h / 2, w, h);
    ctx.restore();
  };

  useEffect(() => {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const img = new Image();
      img.onload = () => {
        imgRef.current = img;
        renderBaseImage(0);
      };
      img.src = reader.result;
    };
    reader.readAsDataURL(file);
  }, [file]);

  useEffect(() => {
    if (imgRef.current) renderBaseImage(rotation);
  }, [isHd, rotation]);

  const getPos = (e) => {
    const rect = canvasRef.current.getBoundingClientRect();
    const scaleX = canvasRef.current.width / rect.width;
    const scaleY = canvasRef.current.height / rect.height;
    return { x: (e.clientX - rect.left) * scaleX, y: (e.clientY - rect.top) * scaleY };
  };

  const addTextOverlay = () => {
    if (!textNote.trim() || !canvasRef.current) return;
    const ctx = canvasRef.current.getContext('2d');
    ctx.font = 'bold 28px sans-serif';
    ctx.fillStyle = drawColor;
    ctx.strokeStyle = '#000';
    ctx.lineWidth = 4;
    ctx.strokeText(textNote.trim(), 24, 48);
    ctx.fillText(textNote.trim(), 24, 48);
    setTextNote('');
  };

  const handleSave = () => {
    if (!canvasRef.current) return;
    canvasRef.current.toBlob(
      (blob) => {
        if (!blob) return;
        const outFile = new File([blob], file.name || `markup_${Date.now()}.jpg`, { type: 'image/jpeg' });
        onConfirm(outFile, isHd);
      },
      'image/jpeg',
      isHd ? 0.96 : 0.72
    );
  };

  return (
    <div style={backdrop} onClick={onClose}>
      <div style={{ ...card, maxWidth: '680px' }} onClick={(e) => e.stopPropagation()}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontWeight: 700 }}>
            <PenTool size={18} color="#38bdf8" /> Image Markup &amp; HD Quality
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: '#94a3b8', cursor: 'pointer' }}><X size={18} /></button>
        </div>

        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem', alignItems: 'center', marginBottom: '0.7rem' }}>
          {['#ef4444', '#22c55e', '#38bdf8', '#facc15', '#ffffff'].map((c) => (
            <button
              key={c}
              type="button"
              onClick={() => setDrawColor(c)}
              style={{ width: 22, height: 22, borderRadius: '50%', background: c, border: drawColor === c ? '2px solid #fff' : '1px solid rgba(255,255,255,0.2)', cursor: 'pointer' }}
            />
          ))}
          <button type="button" onClick={() => setRotation((r) => (r + 90) % 360)} style={{ ...btn, padding: '0.3rem 0.6rem', fontSize: '0.75rem', background: 'rgba(148,163,184,0.2)' }}>
            <RotateCw size={13} /> Rotate
          </button>
          <button
            type="button"
            onClick={() => setIsHd((v) => !v)}
            style={{ ...btn, padding: '0.3rem 0.65rem', fontSize: '0.75rem', background: isHd ? '#16a34a' : 'rgba(148,163,184,0.2)' }}
          >
            <Sparkles size={13} /> {isHd ? 'HD Quality (Original)' : 'Standard Quality'}
          </button>
        </div>

        <div style={{ display: 'flex', gap: '0.4rem', marginBottom: '0.7rem' }}>
          <input value={textNote} onChange={(e) => setTextNote(e.target.value)} placeholder="Type label to stamp on image..." style={inp} />
          <button type="button" onClick={addTextOverlay} style={{ ...btn, background: 'rgba(148,163,184,0.2)' }}><Type size={14} /> Stamp</button>
        </div>

        <div style={{ textAlign: 'center', background: '#020617', borderRadius: '10px', padding: '0.5rem', maxHeight: '52vh', overflow: 'auto' }}>
          <canvas
            ref={canvasRef}
            onMouseDown={(e) => {
              setDrawing(true);
              const ctx = canvasRef.current.getContext('2d');
              const p = getPos(e);
              ctx.beginPath();
              ctx.moveTo(p.x, p.y);
            }}
            onMouseMove={(e) => {
              if (!drawing) return;
              const ctx = canvasRef.current.getContext('2d');
              const p = getPos(e);
              ctx.strokeStyle = drawColor;
              ctx.lineWidth = 4;
              ctx.lineCap = 'round';
              ctx.lineTo(p.x, p.y);
              ctx.stroke();
            }}
            onMouseUp={() => setDrawing(false)}
            onMouseLeave={() => setDrawing(false)}
            style={{ maxWidth: '100%', maxHeight: '48vh', cursor: 'crosshair', borderRadius: '8px' }}
          />
        </div>

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem', marginTop: '0.85rem' }}>
          <button type="button" onClick={onClose} style={{ ...btn, background: 'rgba(148,163,184,0.15)' }}>Cancel</button>
          <button type="button" onClick={handleSave} style={btn}>Attach {isHd ? 'HD ' : ''}Image</button>
        </div>
      </div>
    </div>
  );
};

/* ── 7. Message Reminder Modal (Slack/Telegram style) ── */
export const MessageReminderModal = ({ message, existingReminders = [], onClose, onCreated, onDeleted }) => {
  const [customDateTime, setCustomDateTime] = useState(() => {
    const d = new Date(Date.now() + 30 * 60 * 1000);
    const pad = (n) => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
  });
  const [note, setNote] = useState('');
  const [saving, setSaving] = useState(false);

  const scheduleAt = async (targetDate) => {
    if (!message?._id || saving) return;
    setSaving(true);
    try {
      const res = await api.createMessageReminder(message._id, {
        remindAt: targetDate.toISOString(),
        note: note.trim(),
      });
      if (onCreated) onCreated(res?.data || res);
      onClose();
    } catch (e) {
      alert(e.message || 'Failed to set reminder');
    } finally {
      setSaving(false);
    }
  };

  const getTomorrow9AM = () => {
    const d = new Date();
    d.setDate(d.getDate() + 1);
    d.setHours(9, 0, 0, 0);
    return d;
  };

  return (
    <div style={backdrop} onClick={onClose}>
      <div style={{ ...card, width: 'min(430px, 95vw)' }} onClick={(e) => e.stopPropagation()}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontWeight: 700, fontSize: '1rem' }}>
            <Bell size={18} color="#f59e0b" /> Remind Me About Message
          </div>
          <button type="button" onClick={onClose} style={{ background: 'none', border: 'none', color: '#94a3b8', cursor: 'pointer' }}><X size={18} /></button>
        </div>

        {message && (
          <div style={{
            padding: '0.6rem 0.75rem',
            borderRadius: '10px',
            background: 'rgba(15, 23, 42, 0.75)',
            borderLeft: '3px solid #f59e0b',
            fontSize: '0.82rem',
            color: '#cbd5e1',
            marginBottom: '0.85rem',
            maxHeight: '72px',
            overflow: 'hidden',
          }}>
            <div style={{ fontWeight: 600, color: '#f8fafc', fontSize: '0.76rem', marginBottom: '2px' }}>
              {message.senderName || 'Message'}
            </div>
            {(message.text || '').slice(0, 140) || (message.attachments?.length ? `📎 ${message.attachments.length} attachment(s)` : 'Message')}
          </div>
        )}

        <input
          type="text"
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="Optional reminder note..."
          style={{ ...inp, marginBottom: '0.75rem' }}
        />

        <div style={{ fontSize: '0.75rem', color: '#94a3b8', marginBottom: '0.45rem', fontWeight: 600 }}>Quick Presets</div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.45rem', marginBottom: '0.85rem' }}>
          <button type="button" disabled={saving} onClick={() => scheduleAt(new Date(Date.now() + 15 * 60 * 1000))} style={{ ...btn, background: 'rgba(59,130,246,0.18)', border: '1px solid rgba(59,130,246,0.35)', justifyContent: 'flex-start' }}>
            <Clock size={14} /> In 15 mins
          </button>
          <button type="button" disabled={saving} onClick={() => scheduleAt(new Date(Date.now() + 60 * 60 * 1000))} style={{ ...btn, background: 'rgba(59,130,246,0.18)', border: '1px solid rgba(59,130,246,0.35)', justifyContent: 'flex-start' }}>
            <Clock size={14} /> In 1 hour
          </button>
          <button type="button" disabled={saving} onClick={() => scheduleAt(new Date(Date.now() + 3 * 60 * 60 * 1000))} style={{ ...btn, background: 'rgba(59,130,246,0.18)', border: '1px solid rgba(59,130,246,0.35)', justifyContent: 'flex-start' }}>
            <Clock size={14} /> In 3 hours
          </button>
          <button type="button" disabled={saving} onClick={() => scheduleAt(getTomorrow9AM())} style={{ ...btn, background: 'rgba(245,158,11,0.18)', border: '1px solid rgba(245,158,11,0.35)', color: '#fcd34d', justifyContent: 'flex-start' }}>
            <Calendar size={14} /> Tomorrow 9 AM
          </button>
        </div>

        <div style={{ fontSize: '0.75rem', color: '#94a3b8', marginBottom: '0.35rem', fontWeight: 600 }}>Custom Date & Time</div>
        <div style={{ display: 'flex', gap: '0.45rem', marginBottom: existingReminders.length ? '0.9rem' : 0 }}>
          <input
            type="datetime-local"
            value={customDateTime}
            onChange={(e) => setCustomDateTime(e.target.value)}
            style={{ ...inp, flex: 1 }}
          />
          <button
            type="button"
            disabled={saving || !customDateTime}
            onClick={() => {
              const dt = new Date(customDateTime);
              if (Number.isNaN(dt.getTime()) || dt.getTime() <= Date.now()) {
                return alert('Please choose a valid future date and time');
              }
              scheduleAt(dt);
            }}
            style={btn}
          >
            Set
          </button>
        </div>

        {existingReminders.length > 0 && (
          <div style={{ borderTop: '1px solid rgba(148,163,184,0.18)', paddingTop: '0.65rem' }}>
            <div style={{ fontSize: '0.74rem', color: '#94a3b8', marginBottom: '0.4rem', fontWeight: 600 }}>
              Pending Reminders ({existingReminders.length})
            </div>
            <div style={{ maxHeight: '130px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
              {existingReminders.map((r) => (
                <div key={r._id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '0.5rem', background: 'rgba(15,23,42,0.7)', padding: '0.4rem 0.55rem', borderRadius: '8px', fontSize: '0.76rem' }}>
                  <div style={{ minWidth: 0 }}>
                    <div style={{ color: '#e2e8f0', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {r.note || r.previewText || 'Message reminder'}
                    </div>
                    <div style={{ color: '#f59e0b', fontSize: '0.68rem' }}>
                      {new Date(r.remindAt).toLocaleString()}
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={async () => {
                      try {
                        await api.deleteChatReminder(r._id);
                        if (onDeleted) onDeleted(r._id);
                      } catch (e) {
                        alert(e.message || 'Delete failed');
                      }
                    }}
                    style={{ background: 'none', border: 'none', color: '#f87171', cursor: 'pointer', flexShrink: 0 }}
                    title="Cancel reminder"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

/* ── 8. Draggable Picture-in-Picture (PiP) Mini Call Window ── */
export const DraggablePiPCallWindow = ({
  activeCall,
  isMuted,
  onToggleMute,
  onExpand,
  onEndCall,
}) => {
  const [pos, setPos] = useState(() => ({
    x: typeof window !== 'undefined' ? Math.max(12, window.innerWidth - 310) : 24,
    y: typeof window !== 'undefined' ? Math.max(12, window.innerHeight - 178) : 24,
  }));
  const [elapsed, setElapsed] = useState(0);
  const dragRef = useRef({ dragging: false, offsetX: 0, offsetY: 0 });

  useEffect(() => {
    const start = activeCall?.startedAt ? new Date(activeCall.startedAt).getTime() : Date.now();
    const timer = setInterval(() => {
      setElapsed(Math.max(0, Math.floor((Date.now() - start) / 1000)));
    }, 1000);
    return () => clearInterval(timer);
  }, [activeCall?.startedAt]);

  useEffect(() => {
    const onMove = (e) => {
      if (!dragRef.current.dragging) return;
      const maxX = typeof window !== 'undefined' ? window.innerWidth - 292 : 800;
      const maxY = typeof window !== 'undefined' ? window.innerHeight - 154 : 600;
      setPos({
        x: Math.min(Math.max(8, e.clientX - dragRef.current.offsetX), Math.max(8, maxX)),
        y: Math.min(Math.max(8, e.clientY - dragRef.current.offsetY), Math.max(8, maxY)),
      });
    };
    const onUp = () => {
      dragRef.current.dragging = false;
    };
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
    return () => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
    };
  }, []);

  const mm = String(Math.floor(elapsed / 60)).padStart(2, '0');
  const ss = String(elapsed % 60).padStart(2, '0');
  const isVideo = activeCall?.type === 'video' || activeCall?.callType === 'video';
  const callTitle = activeCall?.recipientName || activeCall?.roomName || activeCall?.peerName || 'Active Call';

  return (
    <div
      className="erp-island-toast"
      onPointerDown={(e) => {
        if (e.target.closest('button')) return;
        dragRef.current = {
          dragging: true,
          offsetX: e.clientX - pos.x,
          offsetY: e.clientY - pos.y,
        };
      }}
      style={{
        position: 'fixed',
        left: `${pos.x}px`,
        top: `${pos.y}px`,
        width: '284px',
        zIndex: 99998,
        borderRadius: '16px',
        background: 'linear-gradient(145deg, rgba(15, 23, 42, 0.96), rgba(30, 41, 59, 0.96))',
        border: '1px solid rgba(59, 130, 246, 0.4)',
        boxShadow: '0 20px 44px rgba(0, 0, 0, 0.55)',
        padding: '0.75rem 0.85rem',
        color: '#f8fafc',
        cursor: 'grab',
        userSelect: 'none',
        touchAction: 'none',
        backdropFilter: 'blur(12px)',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.5rem', marginBottom: '0.65rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.55rem', minWidth: 0 }}>
          <div style={{
            width: '36px',
            height: '36px',
            borderRadius: '11px',
            background: isVideo ? 'rgba(99, 102, 241, 0.25)' : 'rgba(16, 185, 129, 0.25)',
            border: `1px solid ${isVideo ? 'rgba(129,140,248,0.45)' : 'rgba(52,211,153,0.45)'}`,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0,
          }}>
            {isVideo ? <Video size={17} color="#818cf8" /> : <PhoneCall size={17} color="#34d399" />}
          </div>
          <div style={{ minWidth: 0 }}>
            <div style={{ fontWeight: 700, fontSize: '0.84rem', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
              {callTitle}
            </div>
            <div style={{ fontSize: '0.71rem', color: '#34d399', display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
              <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#10b981', display: 'inline-block' }} />
              {isVideo ? 'Video' : 'Voice'} · {mm}:{ss}
            </div>
          </div>
        </div>
        <button
          type="button"
          onClick={onExpand}
          title="Expand Call"
          style={{
            width: '30px',
            height: '30px',
            borderRadius: '9px',
            border: '1px solid rgba(148,163,184,0.28)',
            background: 'rgba(148,163,184,0.14)',
            color: '#e2e8f0',
            cursor: 'pointer',
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Maximize2 size={14} />
        </button>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.45rem' }}>
        <button
          type="button"
          onClick={onToggleMute}
          style={{
            flex: 1,
            height: '34px',
            borderRadius: '10px',
            border: '1px solid rgba(148,163,184,0.25)',
            background: isMuted ? 'rgba(245, 158, 11, 0.2)' : 'rgba(148, 163, 184, 0.14)',
            color: isMuted ? '#fbbf24' : '#e2e8f0',
            fontWeight: 600,
            fontSize: '0.76rem',
            cursor: 'pointer',
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '0.35rem',
          }}
        >
          {isMuted ? <MicOff size={14} /> : <Mic size={14} />}
          {isMuted ? 'Unmute' : 'Mute'}
        </button>
        <button
          type="button"
          onClick={onEndCall}
          style={{
            flex: 1,
            height: '34px',
            borderRadius: '10px',
            border: 'none',
            background: '#ef4444',
            color: '#fff',
            fontWeight: 600,
            fontSize: '0.76rem',
            cursor: 'pointer',
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '0.35rem',
          }}
        >
          <PhoneOff size={14} />
          End
        </button>
      </div>
    </div>
  );
};
