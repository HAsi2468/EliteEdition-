import React, { useState, useEffect, useRef } from 'react';
import { api } from '../services/api';
import {
  CheckSquare,
  Clock,
  Plus,
  Search,
  Filter,
  Users,
  Play,
  Square,
  AlertCircle,
  Calendar,
  Building2,
  Tag,
  Paperclip,
  MessageSquare,
  History,
  Trash2,
  Edit2,
  CheckCircle2,
  X,
  ChevronRight,
  UserCheck,
  FileText,
  Briefcase,
  Layers,
  Sparkles,
  LayoutGrid,
  List,
  ArrowRight,
  ExternalLink
} from 'lucide-react';

export default function TaskManagerPanel({ currentUser, onNavigateTab }) {
  const [tasks, setTasks] = useState([]);
  const [allUsers, setAllUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeView, setActiveView] = useState('kanban'); // 'kanban' | 'list' | 'timesheets'

  // Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [deptFilter, setDeptFilter] = useState('all');
  const [priorityFilter, setPriorityFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');

  // Task Creation Modal
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [creating, setCreating] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [newDesc, setNewDesc] = useState('');
  const [newDept, setNewDept] = useState('Production');
  const [newPriority, setNewPriority] = useState('medium');
  const [newStatus, setNewStatus] = useState('To Do');
  const [newProjectRef, setNewProjectRef] = useState('');
  const [newClientName, setNewClientName] = useState('');
  const [newDueDate, setNewDueDate] = useState('');
  const [newEstHours, setNewEstHours] = useState('');
  const [selectedAssigneeIds, setSelectedAssigneeIds] = useState([]);

  // Selected Task Detail Drawer State
  const [selectedTask, setSelectedTask] = useState(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [newChecklistText, setNewChecklistText] = useState('');
  const [newCommentText, setNewCommentText] = useState('');
  const [timerLogDesc, setTimerLogDesc] = useState('');

  // Active Timer Live Counter
  const [timerTick, setTimerTick] = useState(0);

  const KANBAN_COLUMNS = [
    { id: 'Backlog', label: 'Backlog', color: '#64748b', bg: '#f1f5f9' },
    { id: 'To Do', label: 'To Do', color: '#2563eb', bg: '#eff6ff' },
    { id: 'In Progress', label: 'In Progress', color: '#0284c7', bg: '#e0f2fe' },
    { id: 'In Review', label: 'In Review', color: '#7c3aed', bg: '#f3e8ff' },
    { id: 'Done', label: 'Done', color: '#16a34a', bg: '#f0fdf4' },
  ];

  const DEPARTMENTS = ['Production', 'Fabric', 'Billing', 'Stitching', 'General', 'Design', 'Inventory', 'CRM'];

  const myId = String(currentUser?._id || currentUser?.id || '');
  const myName = currentUser?.name || currentUser?.username || 'Staff';

  useEffect(() => {
    fetchInitialData();
  }, []);

  // Timer ticker interval
  useEffect(() => {
    const interval = setInterval(() => {
      setTimerTick((t) => t + 1);
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  const fetchInitialData = async () => {
    setLoading(true);
    try {
      const [tasksRes, usersRes] = await Promise.all([
        api.getTasks(),
        api.getCommunicationUsers(myId)
      ]);

      if (tasksRes.success && tasksRes.data) {
        setTasks(tasksRes.data);
      }
      if (usersRes.success && usersRes.data) {
        setAllUsers(usersRes.data);
      }
    } catch (err) {
      console.error('Failed to fetch task management data:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateTaskSubmit = async (e) => {
    e.preventDefault();
    if (!newTitle.trim()) {
      alert('Please enter a task title.');
      return;
    }

    setCreating(true);
    try {
      const res = await api.createTask({
        title: newTitle.trim(),
        description: newDesc.trim(),
        department: newDept,
        priority: newPriority,
        status: newStatus,
        projectRef: newProjectRef.trim(),
        clientName: newClientName.trim(),
        dueDate: newDueDate || undefined,
        estimatedHours: parseFloat(newEstHours) || 0,
        assignees: selectedAssigneeIds,
        createdBy: myId,
        createdByName: myName
      });

      if (res.success && res.data) {
        setTasks((prev) => [res.data, ...prev]);
        setShowCreateModal(false);
        resetCreateForm();
      }
    } catch (err) {
      alert('Failed to create task: ' + err.message);
    } finally {
      setCreating(false);
    }
  };

  const resetCreateForm = () => {
    setNewTitle('');
    setNewDesc('');
    setNewDept('Production');
    setNewPriority('medium');
    setNewStatus('To Do');
    setNewProjectRef('');
    setNewClientName('');
    setNewDueDate('');
    setNewEstHours('');
    setSelectedAssigneeIds([]);
  };

  const handleStatusChange = async (task, newStatusVal) => {
    try {
      const res = await api.updateTask(task._id, {
        status: newStatusVal,
        userId: myId,
        userName: myName
      });

      if (res.success && res.data) {
        setTasks((prev) => prev.map((t) => (String(t._id) === String(task._id) ? res.data : t)));
        if (selectedTask && String(selectedTask._id) === String(task._id)) {
          setSelectedTask(res.data);
        }
      }
    } catch (err) {
      alert('Cannot change status: ' + err.message);
    }
  };

  const handleStartTimer = async (taskId, e) => {
    if (e) e.stopPropagation();
    try {
      const res = await api.startTaskTimer(taskId, myId);
      if (res.success && res.data) {
        setTasks((prev) => prev.map((t) => (String(t._id) === String(taskId) ? res.data : t)));
        if (selectedTask && String(selectedTask._id) === String(taskId)) {
          setSelectedTask(res.data);
        }
      }
    } catch (err) {
      alert('Failed to start timer: ' + err.message);
    }
  };

  const handleStopTimer = async (taskId, e) => {
    if (e) e.stopPropagation();
    try {
      const res = await api.stopTaskTimer(taskId, {
        userId: myId,
        userName: myName,
        description: timerLogDesc.trim() || 'Work session',
        isBillable: true
      });

      if (res.success && res.data) {
        setTimerLogDesc('');
        setTasks((prev) => prev.map((t) => (String(t._id) === String(taskId) ? res.data : t)));
        if (selectedTask && String(selectedTask._id) === String(taskId)) {
          setSelectedTask(res.data);
        }
        alert(`Timer stopped! Logged ${res.loggedHours || 0} hours.`);
      }
    } catch (err) {
      alert('Failed to stop timer: ' + err.message);
    }
  };

  const handleAddChecklist = async (e) => {
    e.preventDefault();
    if (!selectedTask || !newChecklistText.trim()) return;

    try {
      const res = await api.addTaskChecklistItem(selectedTask._id, {
        text: newChecklistText.trim()
      });
      if (res.success && res.data) {
        setSelectedTask(res.data);
        setTasks((prev) => prev.map((t) => (String(t._id) === String(selectedTask._id) ? res.data : t)));
        setNewChecklistText('');
      }
    } catch (err) {
      alert('Failed to add checklist item: ' + err.message);
    }
  };

  const handleToggleChecklist = async (itemId, currentCompleted) => {
    if (!selectedTask) return;
    try {
      const res = await api.toggleTaskChecklistItem(selectedTask._id, itemId, !currentCompleted);
      if (res.success && res.data) {
        setSelectedTask(res.data);
        setTasks((prev) => prev.map((t) => (String(t._id) === String(selectedTask._id) ? res.data : t)));
      }
    } catch (err) {
      console.error('Failed to toggle checklist item:', err);
    }
  };

  const handleAddComment = async (e) => {
    e.preventDefault();
    if (!selectedTask || !newCommentText.trim()) return;

    try {
      const res = await api.addTaskComment(selectedTask._id, {
        text: newCommentText.trim(),
        userId: myId,
        senderName: myName
      });
      if (res.success && res.data) {
        setSelectedTask(res.data);
        setTasks((prev) => prev.map((t) => (String(t._id) === String(selectedTask._id) ? res.data : t)));
        setNewCommentText('');
      }
    } catch (err) {
      alert('Failed to add comment: ' + err.message);
    }
  };

  const handleDeleteTask = async (taskId, e) => {
    if (e) e.stopPropagation();
    if (!window.confirm('Are you sure you want to delete this task?')) return;

    try {
      const res = await api.deleteTask(taskId);
      if (res.success) {
        setTasks((prev) => prev.filter((t) => String(t._id) !== String(taskId)));
        if (selectedTask && String(selectedTask._id) === String(taskId)) {
          setSelectedTask(null);
        }
      }
    } catch (err) {
      alert('Failed to delete task: ' + err.message);
    }
  };

  // Filter tasks logic
  const filteredTasks = tasks.filter((t) => {
    if (deptFilter !== 'all' && t.department !== deptFilter) return false;
    if (priorityFilter !== 'all' && t.priority !== priorityFilter) return false;
    if (statusFilter !== 'all' && t.status !== statusFilter) return false;

    const term = searchQuery.toLowerCase().trim();
    if (!term) return true;

    return (
      (t.title || '').toLowerCase().includes(term) ||
      (t.description || '').toLowerCase().includes(term) ||
      (t.projectRef || '').toLowerCase().includes(term) ||
      (t.clientName || '').toLowerCase().includes(term) ||
      (t.department || '').toLowerCase().includes(term)
    );
  });

  const getPriorityBadge = (priority) => {
    switch ((priority || '').toLowerCase()) {
      case 'urgent': return { label: 'URGENT', color: '#dc2626', bg: '#fee2e2', border: '#fca5a5' };
      case 'high': return { label: 'HIGH', color: '#d97706', bg: '#fef3c7', border: '#fde68a' };
      case 'medium': return { label: 'MED', color: '#2563eb', bg: '#eff6ff', border: '#bfdbfe' };
      case 'low': return { label: 'LOW', color: '#64748b', bg: '#f1f5f9', border: '#e2e8f0' };
      default: return { label: 'MED', color: '#2563eb', bg: '#eff6ff', border: '#bfdbfe' };
    }
  };

  const getDeptColor = (dept) => {
    switch ((dept || '').toLowerCase()) {
      case 'production': return '#2563eb';
      case 'fabric': return '#0284c7';
      case 'billing': return '#16a34a';
      case 'stitching': return '#7c3aed';
      case 'design': return '#db2777';
      case 'inventory': return '#0891b2';
      default: return '#2563eb';
    }
  };

  const calculateTotalLoggedHours = (timeLogs = []) => {
    return timeLogs.reduce((acc, log) => acc + (log.hours || 0), 0).toFixed(1);
  };

  const formatElapsedTimer = (startTimeISO) => {
    if (!startTimeISO) return '00:00:00';
    const elapsedSec = Math.max(0, Math.floor((new Date() - new Date(startTimeISO)) / 1000));
    const h = String(Math.floor(elapsedSec / 3600)).padStart(2, '0');
    const m = String(Math.floor((elapsedSec % 3600) / 60)).padStart(2, '0');
    const s = String(elapsedSec % 60).padStart(2, '0');
    return `${h}:${m}:${s}`;
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', gap: '0.75rem', background: 'var(--bg-main)', boxSizing: 'border-box' }}>
      
      {/* ── TOP HEADER CONTROL BAR ── */}
      <div className="glass-panel" style={{ padding: '0.75rem 1.1rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderRadius: '12px', background: '#ffffff', border: '1px solid var(--border-light)', boxShadow: '0 2px 10px rgba(37,99,235,0.05)', flexWrap: 'wrap', gap: '0.6rem' }}>
        
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.7rem' }}>
          <div style={{ width: 38, height: 38, borderRadius: '10px', background: 'linear-gradient(135deg, #38bdf8 0%, #2563eb 100%)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', boxShadow: '0 4px 12px rgba(37,99,235,0.3)' }}>
            <CheckSquare size={22} />
          </div>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <h2 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 800, color: 'var(--text-primary)', letterSpacing: '-0.01em' }}>
                TASK — TaskOPad Workforce &amp; Job Operations
              </h2>
              <span style={{ fontSize: '0.65rem', fontWeight: 800, color: '#2563eb', background: '#eff6ff', border: '1px solid #bfdbfe', padding: '1px 7px', borderRadius: '10px', textTransform: 'uppercase' }}>
                TaskOPad Engine
              </span>
            </div>
            <p style={{ margin: 0, fontSize: '0.74rem', color: 'var(--text-muted)', fontWeight: 500 }}>
              Kanban boards, live time tracking timers, checklists, dependencies &amp; ERP integrations
            </p>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
          
          {/* View Switcher Pills */}
          <div style={{ display: 'flex', background: '#f8fafc', padding: '3px', borderRadius: '8px', border: '1px solid var(--border-light)' }}>
            {[
              { id: 'kanban', label: 'Kanban Board', icon: LayoutGrid },
              { id: 'list', label: 'List View', icon: List },
              { id: 'timesheets', label: 'Timesheets', icon: Clock },
            ].map((v) => {
              const IconComp = v.icon;
              return (
                <button
                  key={v.id}
                  onClick={() => setActiveView(v.id)}
                  style={{
                    background: activeView === v.id ? '#2563eb' : 'transparent',
                    color: activeView === v.id ? '#ffffff' : 'var(--text-muted)',
                    border: 'none',
                    fontSize: '0.74rem',
                    fontWeight: 700,
                    padding: '0.35rem 0.7rem',
                    borderRadius: '6px',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '4px',
                    transition: 'all 0.15s'
                  }}
                >
                  <IconComp size={13} />
                  <span>{v.label}</span>
                </button>
              );
            })}
          </div>

          <button
            onClick={() => setShowCreateModal(true)}
            className="btn-primary"
            style={{ fontSize: '0.8rem', padding: '0.45rem 0.95rem', gap: '0.4rem', borderRadius: '8px', background: 'linear-gradient(135deg, #38bdf8 0%, #2563eb 100%)', boxShadow: '0 4px 12px rgba(37,99,235,0.25)' }}
          >
            <Plus size={15} />
            <span>+ Create Task</span>
          </button>
        </div>
      </div>

      {/* ── FILTERING & SEARCH BAR ── */}
      <div className="glass-panel" style={{ padding: '0.6rem 0.9rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderRadius: '10px', background: '#ffffff', border: '1px solid var(--border-light)', gap: '0.6rem', flexWrap: 'wrap' }}>
        
        <div style={{ position: 'relative', flex: 1, minWidth: 220 }}>
          <Search size={14} style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
          <input
            type="text"
            placeholder="Search tasks by title, project @JC-1004, client, or details..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            style={{ width: '100%', paddingLeft: '32px', fontSize: '0.78rem', height: '32px', background: 'var(--bg-input)', border: '1px solid var(--border-light)', borderRadius: '6px', boxSizing: 'border-box' }}
          />
        </div>

        <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
          
          {/* Dept Filter */}
          <select
            value={deptFilter}
            onChange={(e) => setDeptFilter(e.target.value)}
            style={{ fontSize: '0.75rem', height: '32px', padding: '0 0.5rem', borderRadius: '6px', border: '1px solid var(--border-light)', background: '#ffffff', color: 'var(--text-primary)', fontWeight: 600 }}
          >
            <option value="all">All Departments</option>
            {DEPARTMENTS.map((d) => (
              <option key={d} value={d}>{d}</option>
            ))}
          </select>

          {/* Priority Filter */}
          <select
            value={priorityFilter}
            onChange={(e) => setPriorityFilter(e.target.value)}
            style={{ fontSize: '0.75rem', height: '32px', padding: '0 0.5rem', borderRadius: '6px', border: '1px solid var(--border-light)', background: '#ffffff', color: 'var(--text-primary)', fontWeight: 600 }}
          >
            <option value="all">All Priorities</option>
            <option value="urgent">Urgent</option>
            <option value="high">High</option>
            <option value="medium">Medium</option>
            <option value="low">Low</option>
          </select>
        </div>
      </div>

      {/* ── MAIN CONTENT AREA ── */}
      <div style={{ flex: 1, minHeight: 0, overflow: 'hidden' }}>
        
        {loading ? (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', color: 'var(--text-muted)' }}>
            <Sparkles size={28} className="spin-loader" style={{ marginBottom: '0.6rem', color: '#2563eb' }} />
            <div style={{ fontSize: '0.85rem', fontWeight: 600 }}>Loading TaskOPad workforce board...</div>
          </div>
        ) : activeView === 'kanban' ? (
          
          /* ════ VIEW 1: KANBAN BOARD ════ */
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, minmax(260px, 1fr))', gap: '0.75rem', height: '100%', overflowX: 'auto', paddingBottom: '0.5rem' }}>
            {KANBAN_COLUMNS.map((col) => {
              const colTasks = filteredTasks.filter((t) => t.status === col.id);

              return (
                <div
                  key={col.id}
                  style={{
                    background: '#f8fafc',
                    border: '1px solid var(--border-light)',
                    borderRadius: '12px',
                    display: 'flex',
                    flexDirection: 'column',
                    maxHeight: '100%',
                    overflow: 'hidden'
                  }}
                >
                  {/* Column Header */}
                  <div
                    style={{
                      padding: '0.65rem 0.85rem',
                      borderBottom: '1px solid var(--border-light)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      background: col.bg
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                      <span style={{ width: 8, height: 8, borderRadius: '50%', background: col.color }} />
                      <h4 style={{ margin: 0, fontSize: '0.82rem', fontWeight: 800, color: 'var(--text-primary)' }}>
                        {col.label}
                      </h4>
                    </div>
                    <span style={{ fontSize: '0.68rem', fontWeight: 800, color: col.color, background: '#ffffff', padding: '1px 7px', borderRadius: '10px', border: `1px solid ${col.color}30` }}>
                      {colTasks.length}
                    </span>
                  </div>

                  {/* Task Cards Container */}
                  <div style={{ flex: 1, overflowY: 'auto', padding: '0.5rem', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                    {colTasks.length === 0 ? (
                      <div style={{ padding: '2rem 0.5rem', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.75rem' }}>
                        No tasks in {col.label}
                      </div>
                    ) : (
                      colTasks.map((t) => {
                        const pri = getPriorityBadge(t.priority);
                        const activeTimer = (t.liveTimers || []).find((lt) => String(lt.user) === myId && lt.isRunning);
                        const completedCheck = (t.checklist || []).filter((c) => c.completed).length;
                        const totalCheck = (t.checklist || []).length;
                        const loggedHours = calculateTotalLoggedHours(t.timeLogs);

                        return (
                          <div
                            key={t._id}
                            onClick={() => setSelectedTask(t)}
                            style={{
                              background: '#ffffff',
                              border: activeTimer ? '1.5px solid #2563eb' : '1px solid var(--border-light)',
                              borderRadius: '10px',
                              padding: '0.75rem',
                              cursor: 'pointer',
                              boxShadow: activeTimer ? '0 4px 14px rgba(37,99,235,0.15)' : '0 2px 6px rgba(0,0,0,0.03)',
                              transition: 'transform 0.15s ease, box-shadow 0.15s ease',
                              display: 'flex',
                              flexDirection: 'column',
                              gap: '0.45rem'
                            }}
                          >
                            {/* Badges Row */}
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                              <span style={{ fontSize: '0.6rem', fontWeight: 800, color: pri.color, background: pri.bg, border: `1px solid ${pri.border}`, padding: '1px 6px', borderRadius: '4px', textTransform: 'uppercase' }}>
                                {pri.label}
                              </span>
                              
                              <span style={{ fontSize: '0.62rem', fontWeight: 700, color: getDeptColor(t.department), background: `${getDeptColor(t.department)}15`, padding: '1px 6px', borderRadius: '4px' }}>
                                {t.department || 'General'}
                              </span>
                            </div>

                            {/* Title & Project Ref */}
                            <div>
                              <h5 style={{ margin: '0 0 2px', fontSize: '0.84rem', fontWeight: 700, color: 'var(--text-primary)', lineHeight: 1.3 }}>
                                {t.title}
                              </h5>
                              {t.projectRef && (
                                <div style={{ fontSize: '0.68rem', color: '#2563eb', fontWeight: 700, display: 'inline-flex', alignItems: 'center', gap: '2px' }}>
                                  <ExternalLink size={10} />
                                  <span>{t.projectRef}</span>
                                </div>
                              )}
                            </div>

                            {/* Checklist & Hours Meta */}
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: '0.68rem', color: 'var(--text-muted)', paddingTop: '2px' }}>
                              {totalCheck > 0 ? (
                                <div style={{ display: 'flex', alignItems: 'center', gap: '3px', fontWeight: 600, color: completedCheck === totalCheck ? '#16a34a' : 'var(--text-muted)' }}>
                                  <CheckSquare size={12} />
                                  <span>{completedCheck}/{totalCheck}</span>
                                </div>
                              ) : <span />}

                              <div style={{ display: 'flex', alignItems: 'center', gap: '3px', fontWeight: 600 }}>
                                <Clock size={12} />
                                <span>{loggedHours}h {t.estimatedHours ? `/ ${t.estimatedHours}h` : ''}</span>
                              </div>
                            </div>

                            {/* Footer: Live Timer Button & Move Dropdown */}
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: '3px', paddingTop: '0.4rem', borderTop: '1px solid var(--border-light)' }}>
                              
                              {/* Timer Control */}
                              {activeTimer ? (
                                <button
                                  onClick={(e) => handleStopTimer(t._id, e)}
                                  style={{ background: '#ef4444', color: '#ffffff', border: 'none', borderRadius: '5px', padding: '2px 8px', fontSize: '0.68rem', fontWeight: 800, display: 'flex', alignItems: 'center', gap: '3px', cursor: 'pointer' }}
                                  title="Stop live timer"
                                >
                                  <Square size={10} fill="#ffffff" />
                                  <span>{formatElapsedTimer(activeTimer.startTime)}</span>
                                </button>
                              ) : (
                                <button
                                  onClick={(e) => handleStartTimer(t._id, e)}
                                  style={{ background: 'rgba(37,99,235,0.08)', color: '#2563eb', border: '1px solid rgba(37,99,235,0.2)', borderRadius: '5px', padding: '2px 7px', fontSize: '0.68rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '3px', cursor: 'pointer' }}
                                  title="Start live timer for this task"
                                >
                                  <Play size={10} fill="#2563eb" />
                                  <span>Start Timer</span>
                                </button>
                              )}

                              {/* Status Quick Shift Select */}
                              <select
                                value={t.status}
                                onClick={(e) => e.stopPropagation()}
                                onChange={(e) => handleStatusChange(t, e.target.value)}
                                style={{ fontSize: '0.65rem', padding: '1px 4px', borderRadius: '4px', border: '1px solid var(--border-light)', background: '#ffffff', cursor: 'pointer', fontWeight: 700 }}
                              >
                                {KANBAN_COLUMNS.map((c) => (
                                  <option key={c.id} value={c.id}>{c.label}</option>
                                ))}
                              </select>
                            </div>

                          </div>
                        );
                      })
                    )}
                  </div>
                </div>
              );
            })}
          </div>

        ) : activeView === 'list' ? (

          /* ════ VIEW 2: GRID LIST VIEW ════ */
          <div className="glass-panel" style={{ height: '100%', borderRadius: '12px', overflowY: 'auto', background: '#ffffff' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.78rem' }}>
              <thead>
                <tr style={{ background: '#f8fafc', borderBottom: '1px solid var(--border-light)', textAlign: 'left', color: 'var(--text-muted)' }}>
                  <th style={{ padding: '0.65rem 0.85rem' }}>Task Title</th>
                  <th style={{ padding: '0.65rem 0.85rem' }}>Status</th>
                  <th style={{ padding: '0.65rem 0.85rem' }}>Priority</th>
                  <th style={{ padding: '0.65rem 0.85rem' }}>Department</th>
                  <th style={{ padding: '0.65rem 0.85rem' }}>Project Ref</th>
                  <th style={{ padding: '0.65rem 0.85rem' }}>Hours Logged</th>
                  <th style={{ padding: '0.65rem 0.85rem' }}>Due Date</th>
                  <th style={{ padding: '0.65rem 0.85rem', textAlign: 'right' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredTasks.length === 0 ? (
                  <tr>
                    <td colSpan={8} style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-muted)' }}>
                      No tasks found matching criteria.
                    </td>
                  </tr>
                ) : (
                  filteredTasks.map((t) => {
                    const pri = getPriorityBadge(t.priority);
                    return (
                      <tr
                        key={t._id}
                        onClick={() => setSelectedTask(t)}
                        style={{ borderBottom: '1px solid var(--border-light)', cursor: 'pointer', transition: 'background 0.15s' }}
                      >
                        <td style={{ padding: '0.65rem 0.85rem', fontWeight: 700, color: 'var(--text-primary)' }}>
                          {t.title}
                        </td>
                        <td style={{ padding: '0.65rem 0.85rem' }}>
                          <span style={{ fontSize: '0.68rem', fontWeight: 800, padding: '2px 8px', borderRadius: '6px', background: 'rgba(37,99,235,0.1)', color: '#2563eb' }}>
                            {t.status}
                          </span>
                        </td>
                        <td style={{ padding: '0.65rem 0.85rem' }}>
                          <span style={{ fontSize: '0.65rem', fontWeight: 800, color: pri.color, background: pri.bg, padding: '2px 7px', borderRadius: '4px' }}>
                            {pri.label}
                          </span>
                        </td>
                        <td style={{ padding: '0.65rem 0.85rem', color: getDeptColor(t.department), fontWeight: 700 }}>
                          {t.department}
                        </td>
                        <td style={{ padding: '0.65rem 0.85rem', color: '#2563eb', fontWeight: 700 }}>
                          {t.projectRef || '-'}
                        </td>
                        <td style={{ padding: '0.65rem 0.85rem', fontWeight: 600 }}>
                          {calculateTotalLoggedHours(t.timeLogs)}h {t.estimatedHours ? `/ ${t.estimatedHours}h` : ''}
                        </td>
                        <td style={{ padding: '0.65rem 0.85rem', color: 'var(--text-muted)' }}>
                          {t.dueDate ? new Date(t.dueDate).toLocaleDateString() : '-'}
                        </td>
                        <td style={{ padding: '0.65rem 0.85rem', textAlign: 'right' }}>
                          <button
                            onClick={(e) => handleDeleteTask(t._id, e)}
                            style={{ background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer' }}
                            title="Delete Task"
                          >
                            <Trash2 size={15} />
                          </button>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>

        ) : (

          /* ════ VIEW 3: TIMESHEETS & UTILIZATION VIEW ════ */
          <div className="glass-panel" style={{ height: '100%', borderRadius: '12px', overflowY: 'auto', padding: '1rem', background: '#ffffff' }}>
            <h3 style={{ margin: '0 0 1rem', fontSize: '1rem', fontWeight: 800, color: 'var(--text-primary)' }}>
              Workforce Time Logs &amp; Utilization Summary
            </h3>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '1rem', marginBottom: '1.2rem' }}>
              <div style={{ padding: '1rem', borderRadius: '10px', background: '#eff6ff', border: '1px solid #bfdbfe' }}>
                <div style={{ fontSize: '0.75rem', color: '#2563eb', fontWeight: 700 }}>Total Hours Logged</div>
                <div style={{ fontSize: '1.4rem', fontWeight: 800, color: '#1d4ed8', marginTop: '4px' }}>
                  {tasks.reduce((acc, t) => acc + parseFloat(calculateTotalLoggedHours(t.timeLogs)), 0).toFixed(1)} hrs
                </div>
              </div>

              <div style={{ padding: '1rem', borderRadius: '10px', background: '#f0fdf4', border: '1px solid #bbf7d0' }}>
                <div style={{ fontSize: '0.75rem', color: '#16a34a', fontWeight: 700 }}>Total Billable Hours</div>
                <div style={{ fontSize: '1.4rem', fontWeight: 800, color: '#15803d', marginTop: '4px' }}>
                  {tasks.reduce((acc, t) => acc + (t.timeLogs || []).filter(l => l.isBillable !== false).reduce((a, l) => a + (l.hours || 0), 0), 0).toFixed(1)} hrs
                </div>
              </div>
            </div>

            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.78rem' }}>
              <thead>
                <tr style={{ background: '#f8fafc', borderBottom: '1px solid var(--border-light)', textAlign: 'left' }}>
                  <th style={{ padding: '0.6rem 0.8rem' }}>Staff User</th>
                  <th style={{ padding: '0.6rem 0.8rem' }}>Task Title</th>
                  <th style={{ padding: '0.6rem 0.8rem' }}>Hours</th>
                  <th style={{ padding: '0.6rem 0.8rem' }}>Description</th>
                  <th style={{ padding: '0.6rem 0.8rem' }}>Billable</th>
                  <th style={{ padding: '0.6rem 0.8rem' }}>Date</th>
                </tr>
              </thead>
              <tbody>
                {tasks.flatMap(t => (t.timeLogs || []).map(l => ({ ...l, taskTitle: t.title, taskId: t._id }))).map((log, idx) => (
                  <tr key={idx} style={{ borderBottom: '1px solid var(--border-light)' }}>
                    <td style={{ padding: '0.6rem 0.8rem', fontWeight: 700 }}>{log.userName}</td>
                    <td style={{ padding: '0.6rem 0.8rem', color: '#2563eb', fontWeight: 700 }}>{log.taskTitle}</td>
                    <td style={{ padding: '0.6rem 0.8rem', fontWeight: 800 }}>{log.hours}h</td>
                    <td style={{ padding: '0.6rem 0.8rem', color: 'var(--text-muted)' }}>{log.description || '-'}</td>
                    <td style={{ padding: '0.6rem 0.8rem' }}>
                      <span style={{ fontSize: '0.65rem', fontWeight: 800, padding: '2px 6px', borderRadius: '4px', background: log.isBillable !== false ? '#dcfce7' : '#f1f5f9', color: log.isBillable !== false ? '#15803d' : '#64748b' }}>
                        {log.isBillable !== false ? 'BILLABLE' : 'NON-BILLABLE'}
                      </span>
                    </td>
                    <td style={{ padding: '0.6rem 0.8rem', color: 'var(--text-muted)' }}>
                      {log.createdAt ? new Date(log.createdAt).toLocaleDateString() : '-'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ── CREATE TASK MODAL ── */}
      {showCreateModal && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 9999, background: 'rgba(15, 23, 42, 0.65)', backdropFilter: 'blur(5px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem' }}>
          <div className="glass-panel" style={{ width: '100%', maxWidth: 580, maxHeight: '90vh', borderRadius: '16px', overflow: 'hidden', display: 'flex', flexDirection: 'column', animation: 'slideUp 0.2s ease-out', background: '#ffffff' }}>
            
            <div style={{ padding: '1.1rem 1.4rem', borderBottom: '1px solid var(--border-light)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'linear-gradient(135deg, #0f172a 0%, #1e293b 100%)', color: '#fff' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                <CheckSquare size={20} color="#38bdf8" />
                <h3 style={{ margin: 0, fontSize: '1.05rem', fontWeight: 800, color: '#fff' }}>
                  Create New TaskOPad Task
                </h3>
              </div>
              <button onClick={() => setShowCreateModal(false)} style={{ background: 'rgba(255,255,255,0.1)', border: 'none', color: '#fff', width: 28, height: 28, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
                <X size={16} />
              </button>
            </div>

            <form onSubmit={handleCreateTaskSubmit} style={{ padding: '1.2rem 1.4rem', overflowY: 'auto', flex: 1, display: 'flex', flexDirection: 'column', gap: '0.9rem' }}>
              
              <div>
                <label style={{ fontSize: '0.78rem', fontWeight: 700, color: 'var(--text-primary)', display: 'block', marginBottom: '4px' }}>
                  Task Title *
                </label>
                <input
                  type="text"
                  placeholder="e.g. Prepare Fabric Printing Output Batch #102"
                  value={newTitle}
                  onChange={(e) => setNewTitle(e.target.value)}
                  required
                  style={{ width: '100%', padding: '0.5rem', fontSize: '0.8rem', borderRadius: '6px', border: '1px solid var(--border-light)', background: 'var(--bg-input)' }}
                />
              </div>

              <div>
                <label style={{ fontSize: '0.78rem', fontWeight: 700, color: 'var(--text-primary)', display: 'block', marginBottom: '4px' }}>
                  Description &amp; Work Instructions
                </label>
                <textarea
                  rows={3}
                  placeholder="Enter detailed markdown task requirements..."
                  value={newDesc}
                  onChange={(e) => setNewDesc(e.target.value)}
                  style={{ width: '100%', padding: '0.5rem', fontSize: '0.8rem', borderRadius: '6px', border: '1px solid var(--border-light)', background: 'var(--bg-input)' }}
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.85rem' }}>
                <div>
                  <label style={{ fontSize: '0.78rem', fontWeight: 700, color: 'var(--text-primary)', display: 'block', marginBottom: '4px' }}>
                    Department
                  </label>
                  <select
                    value={newDept}
                    onChange={(e) => setNewDept(e.target.value)}
                    style={{ width: '100%', padding: '0.5rem', fontSize: '0.8rem', borderRadius: '6px', border: '1px solid var(--border-light)', background: 'var(--bg-input)' }}
                  >
                    {DEPARTMENTS.map((d) => (
                      <option key={d} value={d}>{d}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label style={{ fontSize: '0.78rem', fontWeight: 700, color: 'var(--text-primary)', display: 'block', marginBottom: '4px' }}>
                    Priority
                  </label>
                  <select
                    value={newPriority}
                    onChange={(e) => setNewPriority(e.target.value)}
                    style={{ width: '100%', padding: '0.5rem', fontSize: '0.8rem', borderRadius: '6px', border: '1px solid var(--border-light)', background: 'var(--bg-input)' }}
                  >
                    <option value="low">Low</option>
                    <option value="medium">Medium</option>
                    <option value="high">High</option>
                    <option value="urgent">Urgent</option>
                  </select>
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.85rem' }}>
                <div>
                  <label style={{ fontSize: '0.78rem', fontWeight: 700, color: 'var(--text-primary)', display: 'block', marginBottom: '4px' }}>
                    Project / Job Card Ref
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. @JC-1004"
                    value={newProjectRef}
                    onChange={(e) => setNewProjectRef(e.target.value)}
                    style={{ width: '100%', padding: '0.5rem', fontSize: '0.8rem', borderRadius: '6px', border: '1px solid var(--border-light)', background: 'var(--bg-input)' }}
                  />
                </div>

                <div>
                  <label style={{ fontSize: '0.78rem', fontWeight: 700, color: 'var(--text-primary)', display: 'block', marginBottom: '4px' }}>
                    Estimated Hours
                  </label>
                  <input
                    type="number"
                    step="0.5"
                    placeholder="e.g. 4.5"
                    value={newEstHours}
                    onChange={(e) => setNewEstHours(e.target.value)}
                    style={{ width: '100%', padding: '0.5rem', fontSize: '0.8rem', borderRadius: '6px', border: '1px solid var(--border-light)', background: 'var(--bg-input)' }}
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={creating}
                className="btn-primary"
                style={{ marginTop: '0.5rem', padding: '0.6rem', fontSize: '0.85rem', borderRadius: '8px' }}
              >
                {creating ? 'Creating Task...' : 'Create Task'}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* ── TASK DETAIL DRAWER / MODAL ── */}
      {selectedTask && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 9999, background: 'rgba(15, 23, 42, 0.65)', backdropFilter: 'blur(5px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem' }}>
          <div className="glass-panel" style={{ width: '100%', maxWidth: 840, maxHeight: '90vh', borderRadius: '16px', overflow: 'hidden', display: 'flex', flexDirection: 'column', background: '#ffffff', boxShadow: '0 20px 40px rgba(0,0,0,0.3)' }}>
            
            {/* Header */}
            <div style={{ padding: '1rem 1.4rem', borderBottom: '1px solid var(--border-light)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#f8fafc' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                <span style={{ fontSize: '0.68rem', fontWeight: 800, padding: '2px 8px', borderRadius: '6px', background: '#2563eb', color: '#fff' }}>
                  {selectedTask.status}
                </span>
                <h3 style={{ margin: 0, fontSize: '1.05rem', fontWeight: 800, color: 'var(--text-primary)' }}>
                  {selectedTask.title}
                </h3>
              </div>
              <button onClick={() => setSelectedTask(null)} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}>
                <X size={20} />
              </button>
            </div>

            {/* Two-Column Body Layout */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 300px', flex: 1, minHeight: 0, overflow: 'hidden' }}>
              
              {/* LEFT COLUMN: Main Details, Checklists, Comments */}
              <div style={{ padding: '1.2rem', overflowY: 'auto', borderRight: '1px solid var(--border-light)', display: 'flex', flexDirection: 'column', gap: '1.2rem' }}>
                
                {/* Description */}
                <div>
                  <h4 style={{ margin: '0 0 0.4rem', fontSize: '0.85rem', fontWeight: 700, color: 'var(--text-primary)' }}>
                    Description
                  </h4>
                  <div style={{ fontSize: '0.8rem', color: 'var(--text-primary)', background: '#f8fafc', padding: '0.75rem', borderRadius: '8px', border: '1px solid var(--border-light)', whiteSpace: 'pre-wrap' }}>
                    {selectedTask.description || 'No description provided.'}
                  </div>
                </div>

                {/* Checklist */}
                <div>
                  <h4 style={{ margin: '0 0 0.4rem', fontSize: '0.85rem', fontWeight: 700, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <span>Checklist ({ (selectedTask.checklist || []).filter(c => c.completed).length } / { (selectedTask.checklist || []).length })</span>
                  </h4>
                  
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem', marginBottom: '0.6rem' }}>
                    {(selectedTask.checklist || []).map((item) => (
                      <div key={item._id} onClick={() => handleToggleChecklist(item._id, item.completed)} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.45rem 0.65rem', borderRadius: '6px', background: '#f8fafc', border: '1px solid var(--border-light)', cursor: 'pointer' }}>
                        <input type="checkbox" checked={item.completed} onChange={() => {}} style={{ cursor: 'pointer' }} />
                        <span style={{ fontSize: '0.8rem', textDecoration: item.completed ? 'line-through' : 'none', color: item.completed ? 'var(--text-muted)' : 'var(--text-primary)' }}>
                          {item.text}
                        </span>
                      </div>
                    ))}
                  </div>

                  <form onSubmit={handleAddChecklist} style={{ display: 'flex', gap: '0.4rem' }}>
                    <input
                      type="text"
                      placeholder="+ Add checklist item..."
                      value={newChecklistText}
                      onChange={(e) => setNewChecklistText(e.target.value)}
                      style={{ flex: 1, padding: '0.4rem', fontSize: '0.78rem', borderRadius: '6px', border: '1px solid var(--border-light)' }}
                    />
                    <button type="submit" className="btn-primary" style={{ padding: '0.4rem 0.8rem', fontSize: '0.75rem' }}>Add</button>
                  </form>
                </div>

                {/* Activity Feed & Comments */}
                <div>
                  <h4 style={{ margin: '0 0 0.4rem', fontSize: '0.85rem', fontWeight: 700, color: 'var(--text-primary)' }}>
                    Comments &amp; Activity
                  </h4>
                  
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', marginBottom: '0.6rem', maxHeight: 200, overflowY: 'auto' }}>
                    {(selectedTask.comments || []).map((c, idx) => (
                      <div key={idx} style={{ padding: '0.5rem 0.75rem', borderRadius: '8px', background: '#f8fafc', border: '1px solid var(--border-light)' }}>
                        <div style={{ fontSize: '0.7rem', fontWeight: 700, color: '#2563eb' }}>{c.senderName || 'Staff'}</div>
                        <div style={{ fontSize: '0.78rem', color: 'var(--text-primary)', marginTop: '2px' }}>{c.text}</div>
                      </div>
                    ))}
                  </div>

                  <form onSubmit={handleAddComment} style={{ display: 'flex', gap: '0.4rem' }}>
                    <input
                      type="text"
                      placeholder="Write a comment or mention @staff..."
                      value={newCommentText}
                      onChange={(e) => setNewCommentText(e.target.value)}
                      style={{ flex: 1, padding: '0.4rem', fontSize: '0.78rem', borderRadius: '6px', border: '1px solid var(--border-light)' }}
                    />
                    <button type="submit" className="btn-primary" style={{ padding: '0.4rem 0.8rem', fontSize: '0.75rem' }}>Send</button>
                  </form>
                </div>

              </div>

              {/* RIGHT COLUMN: Sidebar Controls */}
              <div style={{ padding: '1.2rem', background: '#f8fafc', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                
                <div>
                  <label style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--text-muted)', display: 'block', marginBottom: '3px' }}>Status</label>
                  <select
                    value={selectedTask.status}
                    onChange={(e) => handleStatusChange(selectedTask, e.target.value)}
                    style={{ width: '100%', padding: '0.45rem', fontSize: '0.78rem', fontWeight: 700, borderRadius: '6px', border: '1px solid var(--border-light)', background: '#ffffff' }}
                  >
                    {KANBAN_COLUMNS.map((c) => (
                      <option key={c.id} value={c.id}>{c.label}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--text-muted)', display: 'block', marginBottom: '3px' }}>Priority</label>
                  <span style={{ fontSize: '0.75rem', fontWeight: 800, padding: '3px 8px', borderRadius: '4px', background: getPriorityBadge(selectedTask.priority).bg, color: getPriorityBadge(selectedTask.priority).color }}>
                    {selectedTask.priority.toUpperCase()}
                  </span>
                </div>

                <div>
                  <label style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--text-muted)', display: 'block', marginBottom: '3px' }}>Department</label>
                  <div style={{ fontSize: '0.8rem', fontWeight: 700, color: getDeptColor(selectedTask.department) }}>
                    {selectedTask.department}
                  </div>
                </div>

                <div>
                  <label style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--text-muted)', display: 'block', marginBottom: '3px' }}>Hours Logged</label>
                  <div style={{ fontSize: '0.85rem', fontWeight: 800, color: '#16a34a' }}>
                    {calculateTotalLoggedHours(selectedTask.timeLogs)}h {selectedTask.estimatedHours ? `/ ${selectedTask.estimatedHours}h` : ''}
                  </div>
                </div>

              </div>

            </div>

          </div>
        </div>
      )}

    </div>
  );
}
