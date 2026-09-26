import React, { useState, useEffect, useRef } from 'react';
import {
  ChevronLeft, ChevronRight, Plus, X, Calendar, Clock, Trash2,
  Flag, Bell, Users, Check, Edit2, Briefcase
} from 'lucide-react';

const EVENT_TYPES = [
  { id: 'deadline', label: 'Deadline', color: '#f87171', bg: 'rgba(239,68,68,0.15)' },
  { id: 'meeting',  label: 'Meeting',  color: '#38bdf8', bg: 'rgba(56,189,248,0.15)' },
  { id: 'delivery', label: 'Delivery', color: '#22c55e', bg: 'rgba(34,197,94,0.15)' },
  { id: 'reminder', label: 'Reminder', color: '#fbbf24', bg: 'rgba(251,191,36,0.15)' },
  { id: 'task',     label: 'Task',     color: '#a855f7', bg: 'rgba(168,85,247,0.15)' },
];

const DAYS_OF_WEEK = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];
const MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December'];

const STORAGE_KEY = 'elite_calendar_events';

function loadEvents() {
  try { return JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]'); } catch { return []; }
}
function saveEvents(evts) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(evts));
}

function fmtDate(d) {
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
}
function timeAgo(dateStr) {
  const d = new Date(dateStr);
  const diff = Math.floor((Date.now() - d.getTime()) / 60000);
  if (diff < 1) return 'just now';
  if (diff < 60) return `${diff}m ago`;
  if (diff < 1440) return `${Math.floor(diff/60)}h ago`;
  return `${Math.floor(diff/1440)}d ago`;
}

export default function CalendarModule({ currentUser }) {
  const today = new Date();
  const [viewMode, setViewMode] = useState('month'); // month | week | list
  const [current, setCurrent] = useState({ year: today.getFullYear(), month: today.getMonth() });
  const [events, setEvents] = useState(loadEvents);
  const [selectedDate, setSelectedDate] = useState(fmtDate(today));
  const [showModal, setShowModal] = useState(false);
  const [editingEvent, setEditingEvent] = useState(null);
  const [form, setForm] = useState({ title: '', type: 'task', date: fmtDate(today), time: '09:00', notes: '', repeat: 'none' });
  const [showDayPanel, setShowDayPanel] = useState(false);

  useEffect(() => { saveEvents(events); }, [events]);

  const getDaysInMonth = (year, month) => new Date(year, month+1, 0).getDate();
  const getFirstDayOfMonth = (year, month) => new Date(year, month, 1).getDay();

  const prevMonth = () => setCurrent(p => p.month === 0 ? { year: p.year-1, month: 11 } : { ...p, month: p.month-1 });
  const nextMonth = () => setCurrent(p => p.month === 11 ? { year: p.year+1, month: 0 } : { ...p, month: p.month+1 });

  const eventsOnDate = (dateStr) => events.filter(e => e.date === dateStr);

  const openAdd = (dateStr) => {
    setEditingEvent(null);
    setForm({ title: '', type: 'task', date: dateStr || selectedDate, time: '09:00', notes: '', repeat: 'none' });
    setShowModal(true);
  };

  const openEdit = (evt) => {
    setEditingEvent(evt);
    setForm({ title: evt.title, type: evt.type, date: evt.date, time: evt.time || '09:00', notes: evt.notes || '', repeat: evt.repeat || 'none' });
    setShowModal(true);
  };

  const saveEvent = () => {
    if (!form.title.trim()) return;
    const payload = { ...form, id: editingEvent?.id || Date.now().toString(), createdBy: currentUser?.name || 'User', createdAt: editingEvent?.createdAt || new Date().toISOString() };
    setEvents(prev => editingEvent ? prev.map(e => e.id === editingEvent.id ? payload : e) : [...prev, payload]);
    setShowModal(false);
  };

  const deleteEvent = (id) => setEvents(prev => prev.filter(e => e.id !== id));

  // Build calendar grid
  const daysInMonth = getDaysInMonth(current.year, current.month);
  const firstDay = getFirstDayOfMonth(current.year, current.month);
  const cells = [];
  // Pad start
  const prevMonthDays = getDaysInMonth(current.year, current.month - 1 < 0 ? 11 : current.month - 1);
  for (let i = firstDay - 1; i >= 0; i--) {
    cells.push({ day: prevMonthDays - i, currentMonth: false, dateStr: null });
  }
  for (let d = 1; d <= daysInMonth; d++) {
    const dateStr = `${current.year}-${String(current.month+1).padStart(2,'0')}-${String(d).padStart(2,'0')}`;
    cells.push({ day: d, currentMonth: true, dateStr });
  }
  // Pad end to complete 6 rows
  let nextDay = 1;
  while (cells.length % 7 !== 0) cells.push({ day: nextDay++, currentMonth: false, dateStr: null });

  const todayStr = fmtDate(today);
  const selectedEvts = eventsOnDate(selectedDate);

  // Upcoming events sorted
  const upcoming = [...events].filter(e => e.date >= todayStr).sort((a,b) => a.date.localeCompare(b.date)).slice(0, 20);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', height: '100%' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.5rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <div style={{ width: '36px', height: '36px', borderRadius: '10px', background: 'linear-gradient(135deg,#6366f1,#38bdf8)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Calendar size={18} color="#fff" />
          </div>
          <div>
            <h2 style={{ fontSize: '1.1rem', fontWeight: 800, color: 'var(--text-primary)', margin: 0 }}>Calendar</h2>
            <p style={{ fontSize: '0.72rem', color: 'var(--text-muted)', margin: 0 }}>Production deadlines, meetings & deliveries</p>
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          {['month','week','list'].map(v => (
            <button key={v} onClick={() => setViewMode(v)}
              style={{ padding: '0.35rem 0.75rem', borderRadius: '8px', border: '1px solid var(--border-light)',
                background: viewMode === v ? 'var(--primary)' : 'transparent',
                color: viewMode === v ? '#fff' : 'var(--text-muted)', fontSize: '0.78rem', fontWeight: 700, cursor: 'pointer', transition: 'all 0.15s' }}>
              {v.charAt(0).toUpperCase()+v.slice(1)}
            </button>
          ))}
          <button onClick={() => openAdd(selectedDate)}
            style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', padding: '0.4rem 0.85rem', borderRadius: '8px',
              background: 'linear-gradient(135deg,#6366f1,#38bdf8)', color: '#fff', border: 'none', fontWeight: 700, fontSize: '0.82rem', cursor: 'pointer' }}>
            <Plus size={14} /> Add Event
          </button>
        </div>
      </div>

      <div style={{ display: 'flex', gap: '1rem', flex: 1, minHeight: 0, overflow: 'hidden' }}>
        {/* Main calendar / list */}
        <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
          {viewMode !== 'list' && (
            <div className="glass-panel" style={{ padding: '1rem' }}>
              {/* Month nav */}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.75rem' }}>
                <button onClick={prevMonth} style={{ background: 'none', border: '1px solid var(--border-light)', borderRadius: '8px', padding: '0.3rem', cursor: 'pointer', color: 'var(--text-primary)', display: 'flex', alignItems: 'center' }}>
                  <ChevronLeft size={16} />
                </button>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <span style={{ fontWeight: 800, fontSize: '1rem', color: 'var(--text-primary)' }}>{MONTHS[current.month]} {current.year}</span>
                  <button onClick={() => setCurrent({ year: today.getFullYear(), month: today.getMonth() })}
                    style={{ fontSize: '0.7rem', padding: '2px 8px', borderRadius: '6px', border: '1px solid var(--primary)', color: 'var(--primary)', background: 'var(--primary-glow)', fontWeight: 700, cursor: 'pointer' }}>Today</button>
                </div>
                <button onClick={nextMonth} style={{ background: 'none', border: '1px solid var(--border-light)', borderRadius: '8px', padding: '0.3rem', cursor: 'pointer', color: 'var(--text-primary)', display: 'flex', alignItems: 'center' }}>
                  <ChevronRight size={16} />
                </button>
              </div>
              {/* Day headers */}
              <div className="calendar-grid" style={{ marginBottom: '4px' }}>
                {DAYS_OF_WEEK.map(d => <div key={d} className="calendar-day-header">{d}</div>)}
              </div>
              {/* Days grid */}
              <div className="calendar-grid">
                {cells.map((cell, i) => {
                  const isToday = cell.dateStr === todayStr;
                  const isSelected = cell.dateStr === selectedDate;
                  const dayEvts = cell.dateStr ? eventsOnDate(cell.dateStr) : [];
                  return (
                    <div key={i}
                      className={`calendar-day-cell${!cell.currentMonth ? ' other-month' : ''}${isToday ? ' today' : ''}${isSelected && !isToday ? ' selected' : ''}`}
                      onClick={() => { if (cell.dateStr) { setSelectedDate(cell.dateStr); setShowDayPanel(true); } }}>
                      <div className="calendar-day-number">{cell.day}</div>
                      {dayEvts.slice(0,3).map(evt => {
                        const et = EVENT_TYPES.find(t => t.id === evt.type) || EVENT_TYPES[4];
                        return (
                          <div key={evt.id} className={`calendar-event-pill type-${evt.type}`}
                            onClick={e => { e.stopPropagation(); openEdit(evt); }}>
                            {evt.title}
                          </div>
                        );
                      })}
                      {dayEvts.length > 3 && <div style={{ fontSize: '0.6rem', color: 'var(--text-muted)', fontWeight: 700 }}>+{dayEvts.length-3} more</div>}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* List View */}
          {viewMode === 'list' && (
            <div className="glass-panel" style={{ padding: '1rem', overflow: 'auto', flex: 1 }}>
              <h3 style={{ fontSize: '0.9rem', fontWeight: 800, color: 'var(--text-primary)', marginBottom: '1rem' }}>Upcoming Events</h3>
              {upcoming.length === 0 ? (
                <div style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '2rem', fontSize: '0.85rem' }}>No upcoming events. <button onClick={() => openAdd()} style={{ color: 'var(--primary)', background: 'none', border: 'none', cursor: 'pointer', fontWeight: 700 }}>Add one</button></div>
              ) : upcoming.map(evt => {
                const et = EVENT_TYPES.find(t => t.id === evt.type) || EVENT_TYPES[4];
                return (
                  <div key={evt.id} style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', padding: '0.75rem', borderRadius: '10px', border: '1px solid var(--border-light)', marginBottom: '0.5rem', background: 'var(--bg-card)', cursor: 'pointer', transition: 'all 0.15s' }}
                    onClick={() => openEdit(evt)}>
                    <div style={{ width: '10px', height: '10px', borderRadius: '50%', background: et.color, flexShrink: 0 }} />
                    <div style={{ flex: 1 }}>
                      <div style={{ fontWeight: 700, fontSize: '0.85rem', color: 'var(--text-primary)' }}>{evt.title}</div>
                      <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>{evt.date} {evt.time && `· ${evt.time}`}</div>
                    </div>
                    <span style={{ fontSize: '0.68rem', padding: '2px 8px', borderRadius: '6px', background: et.bg, color: et.color, fontWeight: 800 }}>{et.label}</span>
                    <button onClick={e => { e.stopPropagation(); deleteEvent(evt.id); }} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', padding: '0.2rem' }}>
                      <Trash2 size={13} />
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Sidebar: Selected day events */}
        <div style={{ width: '240px', flexShrink: 0, display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
          {/* Event type legend */}
          <div className="glass-panel" style={{ padding: '0.85rem' }}>
            <div style={{ fontWeight: 800, fontSize: '0.78rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '0.6rem' }}>Event Types</div>
            {EVENT_TYPES.map(et => (
              <div key={et.id} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.35rem' }}>
                <div style={{ width: '10px', height: '10px', borderRadius: '50%', background: et.color }} />
                <span style={{ fontSize: '0.78rem', color: 'var(--text-primary)', fontWeight: 600 }}>{et.label}</span>
              </div>
            ))}
          </div>

          {/* Selected day */}
          <div className="glass-panel" style={{ padding: '0.85rem', flex: 1 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.75rem' }}>
              <div style={{ fontWeight: 800, fontSize: '0.85rem', color: 'var(--text-primary)' }}>
                {selectedDate === todayStr ? 'Today' : selectedDate}
              </div>
              <button onClick={() => openAdd(selectedDate)} style={{ display: 'flex', alignItems: 'center', gap: '0.25rem', padding: '0.25rem 0.5rem', borderRadius: '6px', background: 'var(--primary-glow)', color: 'var(--primary)', border: '1px solid var(--primary)', fontSize: '0.7rem', fontWeight: 700, cursor: 'pointer' }}>
                <Plus size={11} /> Add
              </button>
            </div>
            {selectedEvts.length === 0 ? (
              <div style={{ textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.78rem', padding: '1rem 0' }}>No events</div>
            ) : selectedEvts.map(evt => {
              const et = EVENT_TYPES.find(t => t.id === evt.type) || EVENT_TYPES[4];
              return (
                <div key={evt.id} style={{ borderLeft: `3px solid ${et.color}`, paddingLeft: '0.6rem', marginBottom: '0.65rem' }}>
                  <div style={{ fontWeight: 700, fontSize: '0.8rem', color: 'var(--text-primary)' }}>{evt.title}</div>
                  {evt.time && <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)' }}>{evt.time}</div>}
                  <div style={{ display: 'flex', gap: '0.35rem', marginTop: '0.25rem' }}>
                    <button onClick={() => openEdit(evt)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--primary)', fontSize: '0.7rem', display: 'flex', alignItems: 'center', gap: '2px', padding: 0, fontFamily: 'var(--font-sans)' }}>
                      <Edit2 size={10} /> Edit
                    </button>
                    <button onClick={() => deleteEvent(evt.id)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#f87171', fontSize: '0.7rem', display: 'flex', alignItems: 'center', gap: '2px', padding: 0, fontFamily: 'var(--font-sans)' }}>
                      <Trash2 size={10} /> Del
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Add/Edit Event Modal */}
      {showModal && (
        <div className="modal-overlay" onClick={() => setShowModal(false)}>
          <div className="modal-content" style={{ maxWidth: '440px', padding: '1.5rem' }} onClick={e => e.stopPropagation()}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.25rem' }}>
              <h3 style={{ fontWeight: 800, fontSize: '1rem', color: 'var(--text-primary)', margin: 0 }}>{editingEvent ? 'Edit Event' : 'New Event'}</h3>
              <button onClick={() => setShowModal(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', display: 'flex', alignItems: 'center' }}><X size={18} /></button>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
              <div>
                <label style={{ fontSize: '0.78rem', fontWeight: 700, color: 'var(--text-muted)', display: 'block', marginBottom: '0.3rem' }}>Title *</label>
                <input value={form.title} onChange={e => setForm(p => ({...p, title: e.target.value}))} placeholder="Event title..." style={{ width: '100%' }} />
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                <div>
                  <label style={{ fontSize: '0.78rem', fontWeight: 700, color: 'var(--text-muted)', display: 'block', marginBottom: '0.3rem' }}>Date</label>
                  <input type="date" value={form.date} onChange={e => setForm(p => ({...p, date: e.target.value}))} style={{ width: '100%' }} />
                </div>
                <div>
                  <label style={{ fontSize: '0.78rem', fontWeight: 700, color: 'var(--text-muted)', display: 'block', marginBottom: '0.3rem' }}>Time</label>
                  <input type="time" value={form.time} onChange={e => setForm(p => ({...p, time: e.target.value}))} style={{ width: '100%' }} />
                </div>
              </div>
              <div>
                <label style={{ fontSize: '0.78rem', fontWeight: 700, color: 'var(--text-muted)', display: 'block', marginBottom: '0.3rem' }}>Type</label>
                <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap' }}>
                  {EVENT_TYPES.map(et => (
                    <button key={et.id} onClick={() => setForm(p => ({...p, type: et.id}))}
                      style={{ padding: '0.3rem 0.65rem', borderRadius: '6px', border: `1.5px solid ${form.type === et.id ? et.color : 'var(--border-light)'}`,
                        background: form.type === et.id ? et.bg : 'transparent', color: form.type === et.id ? et.color : 'var(--text-muted)',
                        fontSize: '0.75rem', fontWeight: 700, cursor: 'pointer', transition: 'all 0.15s' }}>
                      {et.label}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <label style={{ fontSize: '0.78rem', fontWeight: 700, color: 'var(--text-muted)', display: 'block', marginBottom: '0.3rem' }}>Repeat</label>
                <select value={form.repeat} onChange={e => setForm(p => ({...p, repeat: e.target.value}))} style={{ width: '100%' }}>
                  <option value="none">No Repeat</option>
                  <option value="daily">Daily</option>
                  <option value="weekly">Weekly</option>
                  <option value="monthly">Monthly</option>
                </select>
              </div>
              <div>
                <label style={{ fontSize: '0.78rem', fontWeight: 700, color: 'var(--text-muted)', display: 'block', marginBottom: '0.3rem' }}>Notes</label>
                <textarea value={form.notes} onChange={e => setForm(p => ({...p, notes: e.target.value}))} rows={2}
                  placeholder="Optional details..." style={{ width: '100%', resize: 'vertical', background: 'var(--bg-input)', border: '1px solid var(--border-light)', borderRadius: '8px', padding: '0.6rem 0.9rem', color: 'var(--text-primary)', fontSize: '0.9rem', fontFamily: 'var(--font-sans)', outline: 'none' }} />
              </div>
              <div style={{ display: 'flex', gap: '0.65rem', justifyContent: 'flex-end', paddingTop: '0.5rem' }}>
                {editingEvent && (
                  <button onClick={() => { deleteEvent(editingEvent.id); setShowModal(false); }}
                    style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', padding: '0.5rem 1rem', borderRadius: '8px', background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.25)', color: '#f87171', fontWeight: 700, cursor: 'pointer', fontSize: '0.82rem' }}>
                    <Trash2 size={13} /> Delete
                  </button>
                )}
                <button onClick={() => setShowModal(false)} style={{ padding: '0.5rem 1rem', borderRadius: '8px', background: 'transparent', border: '1px solid var(--border-light)', color: 'var(--text-muted)', fontWeight: 600, cursor: 'pointer', fontSize: '0.82rem' }}>Cancel</button>
                <button onClick={saveEvent} style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', padding: '0.5rem 1.2rem', borderRadius: '8px', background: 'linear-gradient(135deg,#6366f1,#38bdf8)', color: '#fff', border: 'none', fontWeight: 700, cursor: 'pointer', fontSize: '0.82rem' }}>
                  <Check size={13} /> {editingEvent ? 'Update' : 'Create'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
