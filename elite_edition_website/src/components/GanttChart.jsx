import React, { useState, useEffect, useMemo } from 'react';
import { 
  Calendar as CalendarIcon, 
  ChevronLeft, 
  ChevronRight, 
  Filter, 
  Search, 
  Plus, 
  CheckCircle2, 
  Clock, 
  AlertTriangle,
  Layers,
  ZoomIn,
  ZoomOut,
  Maximize2,
  X
} from 'lucide-react';
import { api } from '../services/api';

const DEFAULT_GANTT_ITEMS = [
  {
    id: 'g-1',
    name: 'JC-8092 Digital Silk Printing',
    department: 'Digital Print',
    startDate: new Date(Date.now() - 3 * 86400000).toISOString().split('T')[0],
    endDate: new Date(Date.now() + 2 * 86400000).toISOString().split('T')[0],
    progress: 75,
    status: 'In Progress',
    assignee: 'Arun K.',
    color: '#38bdf8'
  },
  {
    id: 'g-2',
    name: 'JC-8095 Fabric Fusing & Coating',
    department: 'Fusing',
    startDate: new Date(Date.now() - 1 * 86400000).toISOString().split('T')[0],
    endDate: new Date(Date.now() + 4 * 86400000).toISOString().split('T')[0],
    progress: 40,
    status: 'In Progress',
    assignee: 'Ramesh V.',
    color: '#818cf8'
  },
  {
    id: 'g-3',
    name: 'JC-8098 Stitching Assembly Batch A',
    department: 'Stitching',
    startDate: new Date(Date.now() + 1 * 86400000).toISOString().split('T')[0],
    endDate: new Date(Date.now() + 7 * 86400000).toISOString().split('T')[0],
    progress: 10,
    status: 'Scheduled',
    assignee: 'Kavita M.',
    color: '#34d399'
  },
  {
    id: 'g-4',
    name: 'JC-8101 Quality Audit & Packaging',
    department: 'QA',
    startDate: new Date(Date.now() + 5 * 86400000).toISOString().split('T')[0],
    endDate: new Date(Date.now() + 9 * 86400000).toISOString().split('T')[0],
    progress: 0,
    status: 'Pending',
    assignee: 'Pooja S.',
    color: '#fbbf24'
  },
  {
    id: 'g-5',
    name: 'Client Order #4012 Final Dispatch',
    department: 'Billing / Dispatch',
    startDate: new Date(Date.now() + 8 * 86400000).toISOString().split('T')[0],
    endDate: new Date(Date.now() + 11 * 86400000).toISOString().split('T')[0],
    progress: 0,
    status: 'Pending',
    assignee: 'Harshit S.',
    color: '#f43f5e'
  },
  {
    id: 'g-6',
    name: 'Design Catalogue Batch Q3 Update',
    department: 'Designing',
    startDate: new Date(Date.now() - 5 * 86400000).toISOString().split('T')[0],
    endDate: new Date(Date.now() - 1 * 86400000).toISOString().split('T')[0],
    progress: 100,
    status: 'Completed',
    assignee: 'Neha P.',
    color: '#a855f7'
  }
];

export default function GanttChart({ currentUser }) {
  const [items, setItems] = useState(() => {
    try {
      const saved = localStorage.getItem('elite_gantt_items');
      return saved ? JSON.parse(saved) : DEFAULT_GANTT_ITEMS;
    } catch {
      return DEFAULT_GANTT_ITEMS;
    }
  });

  const [searchQuery, setSearchQuery] = useState('');
  const [selectedDept, setSelectedDept] = useState('All');
  const [viewMode, setViewMode] = useState('days'); // 'days' | 'weeks'
  const [selectedItem, setSelectedItem] = useState(null);
  const [showAddModal, setShowAddModal] = useState(false);
  const [startDateOffset, setStartDateOffset] = useState(-4); // days from today
  const totalDays = viewMode === 'days' ? 21 : 42;

  // Form for new item
  const [newItem, setNewItem] = useState({
    name: '',
    department: 'Digital Print',
    startDate: new Date().toISOString().split('T')[0],
    endDate: new Date(Date.now() + 5 * 86400000).toISOString().split('T')[0],
    progress: 0,
    status: 'Scheduled',
    assignee: '',
    color: '#38bdf8'
  });

  // Persist items
  useEffect(() => {
    try {
      localStorage.setItem('elite_gantt_items', JSON.stringify(items));
    } catch (e) {
      console.error(e);
    }
  }, [items]);

  // Load from API tasks if possible
  useEffect(() => {
    let isMounted = true;
    (async () => {
      try {
        const res = await api.getTasks();
        const apiTasks = res?.data || res || [];
        if (Array.isArray(apiTasks) && apiTasks.length > 0 && isMounted) {
          const formatted = apiTasks.slice(0, 15).map((t, idx) => {
            const start = t.createdAt ? new Date(t.createdAt).toISOString().split('T')[0] : new Date().toISOString().split('T')[0];
            const end = t.dueDate ? new Date(t.dueDate).toISOString().split('T')[0] : new Date(Date.now() + 4 * 86400000).toISOString().split('T')[0];
            return {
              id: t._id || `task-${idx}`,
              name: t.title || `Task #${idx + 1}`,
              department: t.department || 'Production',
              startDate: start,
              endDate: end,
              progress: t.status === 'Done' ? 100 : t.status === 'In Progress' ? 50 : 15,
              status: t.status || 'In Progress',
              assignee: t.assignedTo?.name || t.assignedTo || 'Unassigned',
              color: t.status === 'Done' ? '#10b981' : t.priority === 'High' ? '#f43f5e' : '#38bdf8'
            };
          });
          // Merge with defaults
          setItems(prev => {
            const ids = new Set(prev.map(p => p.id));
            const newOnes = formatted.filter(f => !ids.has(f.id));
            return [...prev, ...newOnes];
          });
        }
      } catch (err) {
        // Fallback to existing
      }
    })();
    return () => { isMounted = false; };
  }, []);

  // Compute timeline date range
  const timelineDates = useMemo(() => {
    const dates = [];
    const base = new Date();
    base.setHours(0, 0, 0, 0);
    base.setDate(base.getDate() + startDateOffset);

    for (let i = 0; i < totalDays; i++) {
      const d = new Date(base);
      d.setDate(base.getDate() + i);
      dates.push(d);
    }
    return dates;
  }, [startDateOffset, totalDays]);

  const baseDate = timelineDates[0];
  const endDate = timelineDates[timelineDates.length - 1];

  // Helper to compute pixel/percent position of a bar
  const getBarPosition = (startStr, endStr) => {
    const start = new Date(startStr);
    const end = new Date(endStr);
    const msPerDay = 86400000;

    const startDiff = (start - baseDate) / msPerDay;
    const duration = Math.max(1, (end - start) / msPerDay);

    const leftPercent = Math.max(0, Math.min(100, (startDiff / totalDays) * 100));
    const widthPercent = Math.max(2, Math.min(100 - leftPercent, (duration / totalDays) * 100));

    return { leftPercent, widthPercent };
  };

  const filteredItems = useMemo(() => {
    return items.filter(it => {
      const matchesSearch = it.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        it.assignee.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesDept = selectedDept === 'All' || it.department === selectedDept;
      return matchesSearch && matchesDept;
    });
  }, [items, searchQuery, selectedDept]);

  const departments = useMemo(() => {
    const set = new Set(items.map(i => i.department));
    return ['All', ...Array.from(set)];
  }, [items]);

  const handleAddItem = (e) => {
    e.preventDefault();
    if (!newItem.name.trim()) return;
    const created = {
      ...newItem,
      id: `custom-${Date.now()}`
    };
    setItems(prev => [created, ...prev]);
    setShowAddModal(false);
    setNewItem({
      name: '',
      department: 'Digital Print',
      startDate: new Date().toISOString().split('T')[0],
      endDate: new Date(Date.now() + 5 * 86400000).toISOString().split('T')[0],
      progress: 0,
      status: 'Scheduled',
      assignee: '',
      color: '#38bdf8'
    });
  };

  const handleDeleteItem = (id) => {
    setItems(prev => prev.filter(i => i.id !== id));
    if (selectedItem?.id === id) setSelectedItem(null);
  };

  const handleUpdateProgress = (id, progress) => {
    setItems(prev => prev.map(i => i.id === id ? { ...i, progress } : i));
    if (selectedItem?.id === id) {
      setSelectedItem(prev => ({ ...prev, progress }));
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', background: 'var(--bg-main)', color: 'var(--text-primary)', overflow: 'hidden' }}>
      {/* Top Header Bar */}
      <div style={{
        padding: '1rem 1.5rem',
        borderBottom: '1px solid var(--border-light)',
        background: 'var(--bg-card)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexWrap: 'wrap',
        gap: '1rem'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <div style={{
            width: 38,
            height: 38,
            borderRadius: 10,
            background: 'linear-gradient(135deg, #0284c7 0%, #38bdf8 100%)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: '#fff',
            boxShadow: '0 4px 12px rgba(2,132,199,0.3)'
          }}>
            <Layers size={20} />
          </div>
          <div>
            <h2 style={{ margin: 0, fontSize: '1.25rem', fontWeight: 800 }}>Production & Job Gantt</h2>
            <p style={{ margin: 0, fontSize: '0.78rem', color: 'var(--text-muted)' }}>
              Interactive timeline view of job cards, workflows, and delivery milestones
            </p>
          </div>
        </div>

        {/* Controls */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
          {/* Search */}
          <div style={{ position: 'relative' }}>
            <Search size={14} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
            <input
              type="text"
              placeholder="Search tasks, jobs..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              style={{
                padding: '0.45rem 0.75rem 0.45rem 2rem',
                fontSize: '0.82rem',
                borderRadius: 8,
                border: '1px solid var(--border-light)',
                background: 'var(--bg-input)',
                color: 'var(--text-primary)',
                width: 180
              }}
            />
          </div>

          {/* Department Filter */}
          <select
            value={selectedDept}
            onChange={e => setSelectedDept(e.target.value)}
            style={{
              padding: '0.45rem 0.75rem',
              fontSize: '0.82rem',
              borderRadius: 8,
              border: '1px solid var(--border-light)',
              background: 'var(--bg-input)',
              color: 'var(--text-primary)',
              cursor: 'pointer'
            }}
          >
            {departments.map(d => <option key={d} value={d}>{d}</option>)}
          </select>

          {/* Navigation Controls */}
          <div style={{ display: 'flex', alignItems: 'center', background: 'var(--bg-input)', borderRadius: 8, border: '1px solid var(--border-light)', padding: '2px' }}>
            <button
              onClick={() => setStartDateOffset(prev => prev - 7)}
              title="Previous Week"
              style={{ border: 'none', background: 'transparent', padding: '6px', cursor: 'pointer', color: 'var(--text-primary)' }}
            >
              <ChevronLeft size={16} />
            </button>
            <button
              onClick={() => setStartDateOffset(-4)}
              style={{ border: 'none', background: 'transparent', padding: '4px 8px', fontSize: '0.75rem', fontWeight: 700, cursor: 'pointer', color: 'var(--text-primary)' }}
            >
              Today
            </button>
            <button
              onClick={() => setStartDateOffset(prev => prev + 7)}
              title="Next Week"
              style={{ border: 'none', background: 'transparent', padding: '6px', cursor: 'pointer', color: 'var(--text-primary)' }}
            >
              <ChevronRight size={16} />
            </button>
          </div>

          {/* Zoom toggle */}
          <button
            onClick={() => setViewMode(v => v === 'days' ? 'weeks' : 'days')}
            style={{
              padding: '0.45rem 0.75rem',
              fontSize: '0.8rem',
              fontWeight: 700,
              borderRadius: 8,
              border: '1px solid var(--border-light)',
              background: 'var(--bg-input)',
              color: 'var(--text-primary)',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '4px'
            }}
          >
            {viewMode === 'days' ? <ZoomOut size={14} /> : <ZoomIn size={14} />}
            <span>{viewMode === 'days' ? '3 Weeks' : '6 Weeks'}</span>
          </button>

          {/* Add Job */}
          <button
            onClick={() => setShowAddModal(true)}
            style={{
              padding: '0.45rem 0.9rem',
              fontSize: '0.82rem',
              fontWeight: 700,
              borderRadius: 8,
              border: 'none',
              background: 'var(--primary)',
              color: '#fff',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              boxShadow: '0 2px 6px rgba(0,0,0,0.15)'
            }}
          >
            <Plus size={15} />
            <span>Add Task</span>
          </button>
        </div>
      </div>

      {/* Main Gantt Body */}
      <div style={{ flex: 1, display: 'flex', overflow: 'hidden', position: 'relative' }}>
        {/* Left Column: Tasks List */}
        <div style={{
          width: 320,
          flexShrink: 0,
          borderRight: '1px solid var(--border-light)',
          background: 'var(--bg-card)',
          display: 'flex',
          flexDirection: 'column',
          overflowY: 'auto'
        }}>
          {/* Header */}
          <div style={{
            height: 48,
            padding: '0 1rem',
            borderBottom: '1px solid var(--border-light)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            fontSize: '0.78rem',
            fontWeight: 800,
            textTransform: 'uppercase',
            letterSpacing: '0.05em',
            color: 'var(--text-muted)',
            position: 'sticky',
            top: 0,
            background: 'var(--bg-card)',
            zIndex: 10
          }}>
            <span>Task / Job Name</span>
            <span>Progress</span>
          </div>

          {/* List items */}
          {filteredItems.map(item => (
            <div
              key={item.id}
              onClick={() => setSelectedItem(item)}
              style={{
                height: 52,
                padding: '0.5rem 1rem',
                borderBottom: '1px solid var(--border-light)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                cursor: 'pointer',
                background: selectedItem?.id === item.id ? 'var(--nav-active-bg)' : 'transparent',
                transition: 'background 0.15s ease'
              }}
            >
              <div style={{ overflow: 'hidden', paddingRight: '0.5rem' }}>
                <div style={{
                  fontSize: '0.82rem',
                  fontWeight: 700,
                  color: 'var(--text-primary)',
                  whiteSpace: 'nowrap',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis'
                }}>
                  {item.name}
                </div>
                <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', display: 'flex', gap: '6px', alignItems: 'center' }}>
                  <span>{item.department}</span>
                  <span>•</span>
                  <span>{item.assignee}</span>
                </div>
              </div>

              <div style={{ textAlign: 'right', flexShrink: 0 }}>
                <span style={{
                  fontSize: '0.72rem',
                  fontWeight: 800,
                  color: item.progress === 100 ? '#10b981' : item.progress > 40 ? '#0284c7' : '#eab308'
                }}>
                  {item.progress}%
                </span>
              </div>
            </div>
          ))}

          {filteredItems.length === 0 && (
            <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.82rem' }}>
              No tasks match your criteria.
            </div>
          )}
        </div>

        {/* Right Area: Interactive Timeline Grid */}
        <div style={{ flex: 1, overflowX: 'auto', overflowY: 'auto', position: 'relative' }}>
          <div style={{ minWidth: totalDays * 44, height: '100%', display: 'flex', flexDirection: 'column' }}>
            {/* Timeline Date Headers */}
            <div style={{
              height: 48,
              borderBottom: '1px solid var(--border-light)',
              display: 'flex',
              position: 'sticky',
              top: 0,
              background: 'var(--bg-card)',
              zIndex: 10
            }}>
              {timelineDates.map((date, idx) => {
                const isToday = date.toDateString() === new Date().toDateString();
                const isWeekend = date.getDay() === 0 || date.getDay() === 6;
                return (
                  <div
                    key={idx}
                    style={{
                      flex: 1,
                      minWidth: 44,
                      borderRight: '1px solid var(--border-light)',
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      justifyContent: 'center',
                      background: isToday ? 'rgba(56, 189, 248, 0.12)' : isWeekend ? 'rgba(0,0,0,0.02)' : 'transparent',
                      color: isToday ? 'var(--primary)' : 'var(--text-muted)'
                    }}
                  >
                    <span style={{ fontSize: '0.65rem', fontWeight: 700, textTransform: 'uppercase' }}>
                      {date.toLocaleDateString(undefined, { weekday: 'narrow' })}
                    </span>
                    <span style={{
                      fontSize: '0.78rem',
                      fontWeight: isToday ? 900 : 600,
                      color: isToday ? 'var(--primary)' : 'var(--text-primary)'
                    }}>
                      {date.getDate()}
                    </span>
                  </div>
                );
              })}
            </div>

            {/* Timeline Rows */}
            <div style={{ flex: 1 }}>
              {filteredItems.map(item => {
                const { leftPercent, widthPercent } = getBarPosition(item.startDate, item.endDate);
                return (
                  <div
                    key={item.id}
                    style={{
                      height: 52,
                      borderBottom: '1px solid var(--border-light)',
                      position: 'relative',
                      display: 'flex',
                      alignItems: 'center'
                    }}
                  >
                    {/* Grid Background columns */}
                    <div style={{ position: 'absolute', inset: 0, display: 'flex', pointerEvents: 'none' }}>
                      {timelineDates.map((date, idx) => {
                        const isToday = date.toDateString() === new Date().toDateString();
                        const isWeekend = date.getDay() === 0 || date.getDay() === 6;
                        return (
                          <div
                            key={idx}
                            style={{
                              flex: 1,
                              minWidth: 44,
                              borderRight: '1px solid var(--border-light)',
                              background: isToday ? 'rgba(56, 189, 248, 0.05)' : isWeekend ? 'rgba(0,0,0,0.015)' : 'transparent'
                            }}
                          />
                        );
                      })}
                    </div>

                    {/* Gantt Bar */}
                    <div
                      onClick={() => setSelectedItem(item)}
                      style={{
                        position: 'absolute',
                        left: `${leftPercent}%`,
                        width: `${widthPercent}%`,
                        height: 28,
                        borderRadius: 6,
                        background: item.color || '#38bdf8',
                        boxShadow: '0 2px 8px rgba(0,0,0,0.18)',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        overflow: 'hidden',
                        padding: '0 8px',
                        zIndex: 2,
                        transition: 'transform 0.15s ease, opacity 0.15s ease'
                      }}
                      title={`${item.name} (${item.startDate} to ${item.endDate}) — ${item.progress}%`}
                    >
                      {/* Progress fill */}
                      <div
                        style={{
                          position: 'absolute',
                          left: 0,
                          top: 0,
                          bottom: 0,
                          width: `${item.progress}%`,
                          background: 'rgba(0, 0, 0, 0.25)',
                          pointerEvents: 'none'
                        }}
                      />
                      <span style={{
                        position: 'relative',
                        fontSize: '0.72rem',
                        fontWeight: 800,
                        color: '#fff',
                        whiteSpace: 'nowrap',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        textShadow: '0 1px 2px rgba(0,0,0,0.3)'
                      }}>
                        {item.name} • {item.progress}%
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>

      {/* Task Detail Drawer / Modal */}
      {selectedItem && (
        <div style={{
          position: 'fixed',
          top: 0,
          right: 0,
          width: 380,
          maxWidth: '92vw',
          height: '100vh',
          background: 'var(--bg-modal)',
          borderLeft: '1px solid var(--border-light)',
          boxShadow: '-8px 0 32px rgba(0,0,0,0.25)',
          zIndex: 9999,
          display: 'flex',
          flexDirection: 'column',
          padding: '1.5rem',
          animation: 'slideInRight 0.25s ease'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.25rem' }}>
            <h3 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 800 }}>Task Details</h3>
            <button
              onClick={() => setSelectedItem(null)}
              style={{ border: 'none', background: 'transparent', cursor: 'pointer', color: 'var(--text-muted)' }}
            >
              <X size={20} />
            </button>
          </div>

          <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
            <div>
              <label style={{ fontSize: '0.72rem', fontWeight: 800, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Title</label>
              <div style={{ fontSize: '1rem', fontWeight: 800, marginTop: 4 }}>{selectedItem.name}</div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
              <div>
                <label style={{ fontSize: '0.72rem', fontWeight: 800, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Department</label>
                <div style={{ fontSize: '0.85rem', fontWeight: 700, marginTop: 4 }}>{selectedItem.department}</div>
              </div>
              <div>
                <label style={{ fontSize: '0.72rem', fontWeight: 800, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Assignee</label>
                <div style={{ fontSize: '0.85rem', fontWeight: 700, marginTop: 4 }}>{selectedItem.assignee}</div>
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
              <div>
                <label style={{ fontSize: '0.72rem', fontWeight: 800, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Start Date</label>
                <div style={{ fontSize: '0.85rem', marginTop: 4 }}>{selectedItem.startDate}</div>
              </div>
              <div>
                <label style={{ fontSize: '0.72rem', fontWeight: 800, color: 'var(--text-muted)', textTransform: 'uppercase' }}>End Date</label>
                <div style={{ fontSize: '0.85rem', marginTop: 4 }}>{selectedItem.endDate}</div>
              </div>
            </div>

            {/* Progress Slider */}
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <label style={{ fontSize: '0.72rem', fontWeight: 800, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Progress</label>
                <span style={{ fontSize: '0.85rem', fontWeight: 800, color: 'var(--primary)' }}>{selectedItem.progress}%</span>
              </div>
              <input
                type="range"
                min="0"
                max="100"
                value={selectedItem.progress}
                onChange={e => handleUpdateProgress(selectedItem.id, Number(e.target.value))}
                style={{ width: '100%', marginTop: '0.5rem', accentColor: 'var(--primary)', cursor: 'pointer' }}
              />
            </div>

            <div>
              <label style={{ fontSize: '0.72rem', fontWeight: 800, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Status</label>
              <div style={{ marginTop: 6, display: 'flex', gap: '6px' }}>
                {['Scheduled', 'In Progress', 'Completed'].map(st => (
                  <button
                    key={st}
                    onClick={() => {
                      setItems(prev => prev.map(i => i.id === selectedItem.id ? { ...i, status: st, progress: st === 'Completed' ? 100 : i.progress } : i));
                      setSelectedItem(prev => ({ ...prev, status: st, progress: st === 'Completed' ? 100 : prev.progress }));
                    }}
                    style={{
                      padding: '4px 10px',
                      borderRadius: 6,
                      fontSize: '0.75rem',
                      fontWeight: 700,
                      border: '1px solid var(--border-light)',
                      background: selectedItem.status === st ? 'var(--primary)' : 'var(--bg-input)',
                      color: selectedItem.status === st ? '#fff' : 'var(--text-primary)',
                      cursor: 'pointer'
                    }}
                  >
                    {st}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div style={{ paddingTop: '1rem', borderTop: '1px solid var(--border-light)', display: 'flex', gap: '0.75rem' }}>
            <button
              onClick={() => handleDeleteItem(selectedItem.id)}
              style={{
                flex: 1,
                padding: '0.6rem',
                borderRadius: 8,
                border: '1px solid rgba(239,68,68,0.3)',
                background: 'rgba(239,68,68,0.1)',
                color: '#ef4444',
                fontSize: '0.82rem',
                fontWeight: 700,
                cursor: 'pointer'
              }}
            >
              Delete Item
            </button>
            <button
              onClick={() => setSelectedItem(null)}
              style={{
                flex: 1,
                padding: '0.6rem',
                borderRadius: 8,
                border: 'none',
                background: 'var(--primary)',
                color: '#fff',
                fontSize: '0.82rem',
                fontWeight: 700,
                cursor: 'pointer'
              }}
            >
              Close
            </button>
          </div>
        </div>
      )}

      {/* Add Item Modal */}
      {showAddModal && (
        <div style={{
          position: 'fixed',
          inset: 0,
          background: 'rgba(0,0,0,0.5)',
          backdropFilter: 'blur(3px)',
          zIndex: 10000,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '1rem'
        }}>
          <form
            onSubmit={handleAddItem}
            style={{
              width: 440,
              maxWidth: '96vw',
              background: 'var(--bg-modal)',
              borderRadius: 12,
              padding: '1.5rem',
              boxShadow: '0 20px 40px rgba(0,0,0,0.3)',
              border: '1px solid var(--border-light)',
              display: 'flex',
              flexDirection: 'column',
              gap: '1rem'
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h3 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 800 }}>Add Production Task</h3>
              <button
                type="button"
                onClick={() => setShowAddModal(false)}
                style={{ border: 'none', background: 'transparent', cursor: 'pointer', color: 'var(--text-muted)' }}
              >
                <X size={18} />
              </button>
            </div>

            <div>
              <label style={{ fontSize: '0.78rem', fontWeight: 700 }}>Task Name / Job Card</label>
              <input
                type="text"
                required
                value={newItem.name}
                onChange={e => setNewItem({ ...newItem, name: e.target.value })}
                placeholder="e.g. JC-8105 Silk Printing"
                style={{
                  width: '100%',
                  padding: '0.5rem 0.75rem',
                  fontSize: '0.85rem',
                  borderRadius: 8,
                  border: '1px solid var(--border-light)',
                  background: 'var(--bg-input)',
                  color: 'var(--text-primary)',
                  marginTop: 4,
                  boxSizing: 'border-box'
                }}
              />
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
              <div>
                <label style={{ fontSize: '0.78rem', fontWeight: 700 }}>Department</label>
                <select
                  value={newItem.department}
                  onChange={e => setNewItem({ ...newItem, department: e.target.value })}
                  style={{
                    width: '100%',
                    padding: '0.5rem',
                    fontSize: '0.85rem',
                    borderRadius: 8,
                    border: '1px solid var(--border-light)',
                    background: 'var(--bg-input)',
                    color: 'var(--text-primary)',
                    marginTop: 4
                  }}
                >
                  <option value="Digital Print">Digital Print</option>
                  <option value="Fusing">Fusing</option>
                  <option value="Stitching">Stitching</option>
                  <option value="QA">QA</option>
                  <option value="Designing">Designing</option>
                  <option value="Billing / Dispatch">Billing / Dispatch</option>
                </select>
              </div>

              <div>
                <label style={{ fontSize: '0.78rem', fontWeight: 700 }}>Assignee</label>
                <input
                  type="text"
                  value={newItem.assignee}
                  onChange={e => setNewItem({ ...newItem, assignee: e.target.value })}
                  placeholder="e.g. Rahul S."
                  style={{
                    width: '100%',
                    padding: '0.5rem 0.75rem',
                    fontSize: '0.85rem',
                    borderRadius: 8,
                    border: '1px solid var(--border-light)',
                    background: 'var(--bg-input)',
                    color: 'var(--text-primary)',
                    marginTop: 4,
                    boxSizing: 'border-box'
                  }}
                />
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
              <div>
                <label style={{ fontSize: '0.78rem', fontWeight: 700 }}>Start Date</label>
                <input
                  type="date"
                  required
                  value={newItem.startDate}
                  onChange={e => setNewItem({ ...newItem, startDate: e.target.value })}
                  style={{
                    width: '100%',
                    padding: '0.5rem',
                    fontSize: '0.85rem',
                    borderRadius: 8,
                    border: '1px solid var(--border-light)',
                    background: 'var(--bg-input)',
                    color: 'var(--text-primary)',
                    marginTop: 4,
                    boxSizing: 'border-box'
                  }}
                />
              </div>

              <div>
                <label style={{ fontSize: '0.78rem', fontWeight: 700 }}>End Date</label>
                <input
                  type="date"
                  required
                  value={newItem.endDate}
                  onChange={e => setNewItem({ ...newItem, endDate: e.target.value })}
                  style={{
                    width: '100%',
                    padding: '0.5rem',
                    fontSize: '0.85rem',
                    borderRadius: 8,
                    border: '1px solid var(--border-light)',
                    background: 'var(--bg-input)',
                    color: 'var(--text-primary)',
                    marginTop: 4,
                    boxSizing: 'border-box'
                  }}
                />
              </div>
            </div>

            <div>
              <label style={{ fontSize: '0.78rem', fontWeight: 700 }}>Color Theme</label>
              <div style={{ display: 'flex', gap: '8px', marginTop: 6 }}>
                {['#38bdf8', '#818cf8', '#34d399', '#fbbf24', '#f43f5e', '#a855f7'].map(c => (
                  <button
                    type="button"
                    key={c}
                    onClick={() => setNewItem({ ...newItem, color: c })}
                    style={{
                      width: 28,
                      height: 28,
                      borderRadius: '50%',
                      background: c,
                      border: newItem.color === c ? '2.5px solid var(--text-primary)' : '2px solid transparent',
                      cursor: 'pointer'
                    }}
                  />
                ))}
              </div>
            </div>

            <div style={{ display: 'flex', gap: '0.75rem', marginTop: '0.5rem' }}>
              <button
                type="button"
                onClick={() => setShowAddModal(false)}
                style={{
                  flex: 1,
                  padding: '0.6rem',
                  borderRadius: 8,
                  border: '1px solid var(--border-light)',
                  background: 'var(--bg-input)',
                  color: 'var(--text-primary)',
                  fontSize: '0.82rem',
                  fontWeight: 700,
                  cursor: 'pointer'
                }}
              >
                Cancel
              </button>
              <button
                type="submit"
                style={{
                  flex: 1,
                  padding: '0.6rem',
                  borderRadius: 8,
                  border: 'none',
                  background: 'var(--primary)',
                  color: '#fff',
                  fontSize: '0.82rem',
                  fontWeight: 700,
                  cursor: 'pointer'
                }}
              >
                Create Task
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
