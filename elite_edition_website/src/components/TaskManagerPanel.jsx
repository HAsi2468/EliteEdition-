import React, { useState, useEffect, useRef } from 'react';
import { api } from '../services/api';
import { useSocket } from '../contexts/SocketContext';
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
  ExternalLink,
  User,
  UserPlus,
  Trophy,
  Mic,
  MicOff,
  Repeat,
  BarChart2,
  CalendarRange,
  Wand2,
  Award,
  Zap,
  TrendingUp,
  Star
} from 'lucide-react';

const TASK_TEMPLATES = [
  {
    id: 'digital_print_qc',
    name: '🎨 Digital Print Audit SOP',
    category: 'Production',
    title: 'Digital Print Audit & CMYK Calibration',
    desc: 'Verify color fidelity, DPI resolution, nozzle alignment, and print proof generation before running bulk production.',
    priority: 'high',
    estHours: 1.5,
    checklist: [
      'Verify CMYK color profile matching job card sample',
      'Check design resolution (Minimum 300 DPI required)',
      'Run printhead nozzle test & check alignment',
      'Generate digital print proof and attach to Job Card'
    ]
  },
  {
    id: 'stitching_qc',
    name: '🪡 Stitching & Finishing QC SOP',
    category: 'Quality Assurance',
    title: 'Stitching & Finishing Quality Inspection',
    desc: 'Comprehensive post-production audit for seam strength, thread shade matching, and garment packaging.',
    priority: 'medium',
    estHours: 2.0,
    checklist: [
      'Inspect seam tension and stitch density (12 SPI min)',
      'Verify thread color and shade accuracy',
      'Check zipper/button alignment and functional clearance',
      'Pack finished order in protective poly sleeve'
    ]
  },
  {
    id: 'fabric_inward',
    name: '📦 Fabric Inward Quality Inspection',
    category: 'Inventory',
    title: 'Fabric Inward Goods Inspection & Tagging',
    desc: 'Audit newly arrived fabric rolls for weight, GSM density, weaving flaws, and barcode tagging.',
    priority: 'high',
    estHours: 1.0,
    checklist: [
      'Weigh incoming fabric rolls & verify supplier bill',
      'Measure GSM density using GSM cutter scale',
      'Scan fabric for weave defects, stains, or shade variation',
      'Generate & attach store inventory QR/Barcode tag'
    ]
  },
  {
    id: 'machine_maint',
    name: '🛠️ Machine Preventive Maintenance SOP',
    category: 'Maintenance',
    title: 'Weekly Production Machinery Maintenance',
    desc: 'Routine cleaning, rail lubrication, sensor testing, and calibration of digital printing & cutting machinery.',
    priority: 'urgent',
    estHours: 3.0,
    checklist: [
      'Clean printhead capping station & wiper blades',
      'Lubricate linear motion rails and gear tracks',
      'Test ink level float sensors and vacuum suction pump',
      'Run bi-directional alignment calibration print'
    ]
  },
  {
    id: 'billing_audit',
    name: '📄 Billing & Invoice Verification SOP',
    category: 'Finance',
    title: 'Billing Audit & Client Payment Processing',
    desc: 'Cross-check finished job card quantities against rates, generate GST tax invoice, and send digital link.',
    priority: 'medium',
    estHours: 0.5,
    checklist: [
      'Match delivered quantity with signed Job Card receipt',
      'Calculate applicable GST tax rate and discount terms',
      'Generate official Billing Invoice & payment link',
      'File digital invoice copy in accounting records'
    ]
  }
];

export default function TaskManagerPanel({ currentUser, onNavigateTab }) {
  const { socket } = useSocket() || {};
  const [tasks, setTasks] = useState([]);
  const [allUsers, setAllUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeView, setActiveView] = useState('kanban'); // 'kanban' | 'list' | 'timeline' | 'leaderboard' | 'timesheets'

  // Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [assigneeFilter, setAssigneeFilter] = useState('all');
  const [priorityFilter, setPriorityFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');

  // Task Creation Modal State
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [creating, setCreating] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [newDesc, setNewDesc] = useState('');
  const [newPriority, setNewPriority] = useState('medium');
  const [newStatus, setNewStatus] = useState('To Do');
  const [newProjectRef, setNewProjectRef] = useState('');
  const [newClientName, setNewClientName] = useState('');
  const [newDueDate, setNewDueDate] = useState('');
  const [newEstHours, setNewEstHours] = useState('');
  const [selectedAssigneeIds, setSelectedAssigneeIds] = useState([]);
  const [staffSearch, setStaffSearch] = useState('');
  
  // Feature 4: Task Template Library state
  const [selectedTemplateId, setSelectedTemplateId] = useState('');
  const [templateChecklist, setTemplateChecklist] = useState([]);

  // Feature 5: Voice-to-Task Creation state
  const [isListening, setIsListening] = useState(false);
  const [voiceTarget, setVoiceTarget] = useState('title'); // 'title' | 'desc'
  const recognitionRef = useRef(null);

  // Feature 8: Automated Recurring Tasks state
  const [isRecurring, setIsRecurring] = useState(false);
  const [recurrenceFreq, setRecurrenceFreq] = useState('daily'); // 'daily' | 'weekly' | 'monthly'

  // Speech Recognition Handler
  const startVoiceInput = (targetField = 'title') => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      alert('Voice Speech-to-Text is not supported in this browser window. Please use Google Chrome, Safari, or Microsoft Edge.');
      return;
    }

    if (isListening) {
      if (recognitionRef.current) recognitionRef.current.stop();
      setIsListening(false);
      return;
    }

    try {
      const recognition = new SpeechRecognition();
      recognition.continuous = false;
      recognition.interimResults = true;
      recognition.lang = 'en-US';

      recognition.onstart = () => {
        setIsListening(true);
        setVoiceTarget(targetField);
      };

      recognition.onresult = (event) => {
        const transcript = Array.from(event.results)
          .map(result => result[0].transcript)
          .join('');
        
        if (targetField === 'title') {
          setNewTitle(transcript);
        } else {
          setNewDesc(transcript);
        }
      };

      recognition.onerror = (event) => {
        console.error('Speech recognition error:', event.error);
        setIsListening(false);
      };

      recognition.onend = () => {
        setIsListening(false);
      };

      recognitionRef.current = recognition;
      recognition.start();
    } catch (err) {
      console.error('Failed to start speech recognition:', err);
      setIsListening(false);
    }
  };

  // Apply Template SOP
  const handleApplyTemplate = (templateId) => {
    setSelectedTemplateId(templateId);
    if (!templateId) return;
    const tmpl = TASK_TEMPLATES.find((t) => t.id === templateId);
    if (tmpl) {
      setNewTitle(tmpl.title);
      setNewDesc(tmpl.desc);
      setNewPriority(tmpl.priority);
      setNewEstHours(String(tmpl.estHours));
      setTemplateChecklist([...tmpl.checklist]);
    }
  };

  // Selected Task Detail Drawer State
  const [selectedTask, setSelectedTask] = useState(null);
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

  const myId = String(currentUser?._id || currentUser?.id || '');
  const myName = currentUser?.name || currentUser?.username || 'Staff';

  useEffect(() => {
    fetchInitialData();
  }, []);

  // ── REAL-TIME SOCKET EVENT LISTENERS ──
  useEffect(() => {
    if (!socket) return;

    const handleTaskCreated = (newTask) => {
      setTasks((prev) => {
        if (prev.some((t) => String(t._id) === String(newTask._id))) return prev;
        return [newTask, ...prev];
      });
    };

    const handleTaskUpdated = (updatedTask) => {
      setTasks((prev) => prev.map((t) => (String(t._id) === String(updatedTask._id) ? updatedTask : t)));
      setSelectedTask((prev) => (prev && String(prev._id) === String(updatedTask._id) ? updatedTask : prev));
    };

    const handleTaskDeleted = (deletedData) => {
      const delId = deletedData._id || deletedData.taskId;
      setTasks((prev) => prev.filter((t) => String(t._id) !== String(delId)));
      setSelectedTask((prev) => (prev && String(prev._id) === String(delId) ? null : prev));
    };

    socket.on('task-created', handleTaskCreated);
    socket.on('task-updated', handleTaskUpdated);
    socket.on('task-deleted', handleTaskDeleted);

    return () => {
      socket.off('task-created', handleTaskCreated);
      socket.off('task-updated', handleTaskUpdated);
      socket.off('task-deleted', handleTaskDeleted);
    };
  }, [socket]);

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
        setSelectedAssigneeIds([]);
      }
    } catch (err) {
      console.error('Failed to fetch task management data:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleOpenCreateModal = () => {
    setShowCreateModal(true);
    setStaffSearch('');
    setSelectedAssigneeIds([]);
  };

  const toggleAssigneeSelection = (userId) => {
    setSelectedAssigneeIds((prev) =>
      prev.includes(userId) ? prev.filter((id) => id !== userId) : [...prev, userId]
    );
  };

  const handleSelectAllStaff = () => {
    setSelectedAssigneeIds(allUsers.map((u) => String(u._id)));
  };

  const handleDeselectAllStaff = () => {
    setSelectedAssigneeIds([]);
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
        priority: newPriority,
        status: newStatus,
        projectRef: newProjectRef.trim(),
        clientName: newClientName.trim(),
        dueDate: newDueDate || undefined,
        estimatedHours: parseFloat(newEstHours) || 0,
        assignees: selectedAssigneeIds,
        createdBy: myId,
        createdByName: myName,
        recurrence: isRecurring ? { isRecurring: true, frequency: recurrenceFreq } : { isRecurring: false }
      });

      if (res.success && res.data) {
        let createdTask = res.data;

        // If template checklist items exist, add them to the created task
        if (templateChecklist && templateChecklist.length > 0) {
          for (const itemText of templateChecklist) {
            try {
              const checkRes = await api.addTaskChecklistItem(createdTask._id, { text: itemText });
              if (checkRes.success && checkRes.data) {
                createdTask = checkRes.data;
              }
            } catch (cErr) {
              console.error('Failed to add template checklist item:', cErr);
            }
          }
        }

        setTasks((prev) => [createdTask, ...prev]);
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
    setNewPriority('medium');
    setNewStatus('To Do');
    setNewProjectRef('');
    setNewClientName('');
    setNewDueDate('');
    setNewEstHours('');
    setSelectedAssigneeIds([]);
    setSelectedTemplateId('');
    setTemplateChecklist([]);
    setIsRecurring(false);
    setRecurrenceFreq('daily');
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

  const handleUpdateAssignees = async (task, newAssigneeIds) => {
    try {
      const res = await api.updateTask(task._id, {
        assignees: newAssigneeIds,
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
      alert('Failed to update task assignees: ' + err.message);
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

  const [quickScope, setQuickScope] = useState('all'); // 'all' | 'my_tasks' | 'due_today' | 'overdue'

  // Filter tasks logic
  const filteredTasks = tasks.filter((t) => {
    if (priorityFilter !== 'all' && t.priority !== priorityFilter) return false;
    if (statusFilter !== 'all' && t.status !== statusFilter) return false;
    if (assigneeFilter !== 'all') {
      const hasAssignee = (t.assignees || []).some((a) => {
        const aId = String(typeof a === 'object' ? (a._id || a.id) : a);
        return aId === assigneeFilter;
      });
      if (!hasAssignee) return false;
    }

    if (quickScope === 'my_tasks') {
      const isMine = (t.assignees || []).some((a) => {
        const aId = String(typeof a === 'object' ? (a._id || a.id) : a);
        return aId === myId;
      });
      if (!isMine && String(t.createdBy?._id || t.createdBy) !== myId) return false;
    }

    if (quickScope === 'due_today') {
      if (!t.dueDate) return false;
      const todayStr = new Date().toDateString();
      const dueStr = new Date(t.dueDate).toDateString();
      if (todayStr !== dueStr) return false;
    }

    if (quickScope === 'overdue') {
      const isOverdue = t.dueDate && new Date(t.dueDate) < new Date() && t.status !== 'Done';
      if (!isOverdue) return false;
    }

    const term = searchQuery.toLowerCase().trim();
    if (!term) return true;

    return (
      (t.title || '').toLowerCase().includes(term) ||
      (t.description || '').toLowerCase().includes(term) ||
      (t.projectRef || '').toLowerCase().includes(term) ||
      (t.clientName || '').toLowerCase().includes(term)
    );
  });

  const getPriorityBadge = (priority) => {
    switch ((priority || '').toLowerCase()) {
      case 'urgent': return { label: '🔥 URGENT', color: '#dc2626', bg: '#fee2e2', border: '#fca5a5' };
      case 'high': return { label: '⚡ HIGH', color: '#d97706', bg: '#fef3c7', border: '#fde68a' };
      case 'medium': return { label: '🟡 MED', color: '#2563eb', bg: '#eff6ff', border: '#bfdbfe' };
      case 'low': return { label: '🟢 LOW', color: '#16a34a', bg: '#f0fdf4', border: '#bbf7d0' };
      default: return { label: '🟡 MED', color: '#2563eb', bg: '#eff6ff', border: '#bfdbfe' };
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

  const getAssignerName = (task) => {
    if (!task) return 'Admin';
    if (task.createdBy && typeof task.createdBy === 'object') {
      return task.createdBy.name || task.createdBy.username || 'Admin';
    }
    if (task.auditLogs && task.auditLogs.length > 0) {
      const createdLog = task.auditLogs.find((l) => l.fieldChanged === 'Task Created') || task.auditLogs[0];
      if (createdLog && createdLog.userName) return createdLog.userName;
    }
    return 'Admin';
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
            <h2 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 800, color: 'var(--text-primary)', letterSpacing: '-0.01em' }}>
              Workforce Task Manager
            </h2>
            <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '6px' }}>
              <span>{filteredTasks.length} Tasks Listed</span>
              {tasks.filter(t => t.activeTimer && t.activeTimer.startTime).length > 0 && (
                <span style={{ color: '#16a34a', background: '#dcfce7', border: '1px solid #86efac', padding: '1px 6px', borderRadius: '4px', fontWeight: 800 }}>
                  ⏱️ {tasks.filter(t => t.activeTimer && t.activeTimer.startTime).length} Active Timers
                </span>
              )}
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
          
          {/* View Switcher Pills */}
          <div style={{ display: 'flex', background: '#f8fafc', padding: '3px', borderRadius: '8px', border: '1px solid var(--border-light)', flexWrap: 'wrap', gap: '2px' }}>
            {[
              { id: 'kanban', label: 'Kanban Board', icon: LayoutGrid },
              { id: 'list', label: 'List View', icon: List },
              { id: 'timeline', label: '📊 Timeline / Gantt', icon: CalendarRange },
              { id: 'leaderboard', label: '🏆 Leaderboard', icon: Trophy },
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
                    padding: '0.35rem 0.65rem',
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
            onClick={handleOpenCreateModal}
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

        <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', flexWrap: 'wrap' }}>
          {/* Quick Scope Filter Pills */}
          <div style={{ display: 'flex', background: '#f8fafc', padding: '2px', borderRadius: '8px', border: '1px solid var(--border-light)' }}>
            {[
              { id: 'all', label: 'All Tasks' },
              { id: 'my_tasks', label: '👤 Mine' },
              { id: 'due_today', label: '⏰ Due Today' },
              { id: 'overdue', label: '🚨 Overdue' },
            ].map((scope) => (
              <button
                key={scope.id}
                onClick={() => setQuickScope(scope.id)}
                style={{
                  background: quickScope === scope.id ? '#2563eb' : 'transparent',
                  color: quickScope === scope.id ? '#ffffff' : 'var(--text-muted)',
                  border: 'none',
                  fontSize: '0.72rem',
                  fontWeight: quickScope === scope.id ? 800 : 600,
                  padding: '0.25rem 0.55rem',
                  borderRadius: '6px',
                  cursor: 'pointer',
                  transition: 'all 0.15s ease'
                }}
              >
                {scope.label}
              </button>
            ))}
          </div>

          {/* Filter by Assignee */}
          <select
            value={assigneeFilter}
            onChange={(e) => setAssigneeFilter(e.target.value)}
            style={{ fontSize: '0.75rem', height: '32px', padding: '0 0.5rem', borderRadius: '6px', border: '1px solid var(--border-light)', background: '#ffffff', color: 'var(--text-primary)', fontWeight: 600 }}
          >
            <option value="all">Filter by Assignee: All Staff</option>
            {allUsers.map((u) => (
              <option key={u._id} value={u._id}>{u.name || u.username}</option>
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
                        const completedCheck = (t.checklist || []).filter((c) => c.completed).length;
                        const totalCheck = (t.checklist || []).length;
                        const assignerName = getAssignerName(t);
                        const isOverdue = t.dueDate && new Date(t.dueDate) < new Date() && t.status !== 'Done';

                        return (
                          <div
                            key={t._id}
                            onClick={() => setSelectedTask(t)}
                            style={{
                              background: '#ffffff',
                              border: isOverdue ? '1.5px solid #ef4444' : '1px solid var(--border-light)',
                              borderRadius: '10px',
                              padding: '0.75rem',
                              cursor: 'pointer',
                              boxShadow: isOverdue ? '0 4px 14px rgba(239,68,68,0.12)' : '0 2px 6px rgba(0,0,0,0.03)',
                              transition: 'transform 0.15s ease, box-shadow 0.15s ease',
                              display: 'flex',
                              flexDirection: 'column',
                              gap: '0.45rem'
                            }}
                          >
                            {/* Badges Row */}
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '4px', flexWrap: 'wrap' }}>
                                <span style={{ fontSize: '0.6rem', fontWeight: 800, color: pri.color, background: pri.bg, border: `1px solid ${pri.border}`, padding: '1px 6px', borderRadius: '4px', textTransform: 'uppercase' }}>
                                  {pri.label}
                                </span>
                                {t.recurrence && t.recurrence.isRecurring && (
                                  <span style={{ fontSize: '0.6rem', fontWeight: 800, color: '#7c3aed', background: '#f3e8ff', border: '1px solid #ddd6fe', padding: '1px 6px', borderRadius: '4px' }}>
                                    🔄 {t.recurrence.frequency ? t.recurrence.frequency.toUpperCase() : 'RECURRING'}
                                  </span>
                                )}
                                {isOverdue && (
                                  <span style={{ fontSize: '0.6rem', fontWeight: 800, color: '#ef4444', background: '#fef2f2', border: '1px solid #fca5a5', padding: '1px 6px', borderRadius: '4px', textTransform: 'uppercase' }}>
                                    🚨 OVERDUE
                                  </span>
                                )}
                              </div>
                              
                              {/* Assigned By Pill */}
                              <span style={{ fontSize: '0.62rem', fontWeight: 700, color: '#475569', background: '#f1f5f9', padding: '1px 6px', borderRadius: '4px' }}>
                                By: <strong>{assignerName}</strong>
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

                            {/* Assigned To Row */}
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', flexWrap: 'wrap' }}>
                              <span style={{ fontSize: '0.65rem', fontWeight: 700, color: 'var(--text-muted)' }}>Assigned To:</span>
                              {(t.assignees || []).length === 0 ? (
                                <span style={{ fontSize: '0.65rem', color: '#94a3b8', italic: 'true' }}>Unassigned</span>
                              ) : (
                                (t.assignees || []).map((a) => (
                                  <span key={a._id || a} style={{ fontSize: '0.64rem', fontWeight: 800, background: '#eff6ff', color: '#2563eb', border: '1px solid #bfdbfe', padding: '1px 6px', borderRadius: '10px' }}>
                                    {typeof a === 'object' ? (a.name || a.username) : 'Staff'}
                                  </span>
                                ))
                              )}
                            </div>

                            {/* Sub-Task Checklist Visual Progress Bar */}
                            {totalCheck > 0 && (
                              <div style={{ marginTop: '2px' }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.62rem', color: 'var(--text-muted)', fontWeight: 700, marginBottom: '2px' }}>
                                  <span style={{ display: 'flex', alignItems: 'center', gap: '3px' }}>
                                    <CheckSquare size={11} color={completedCheck === totalCheck ? '#16a34a' : 'var(--primary)'} />
                                    <span>Checklist</span>
                                  </span>
                                  <span>{completedCheck}/{totalCheck} ({Math.round((completedCheck / totalCheck) * 100)}%)</span>
                                </div>
                                <div style={{ width: '100%', height: '4px', background: '#e2e8f0', borderRadius: '4px', overflow: 'hidden' }}>
                                  <div style={{ width: `${(completedCheck / totalCheck) * 100}%`, height: '100%', background: completedCheck === totalCheck ? '#16a34a' : '#2563eb', transition: 'width 0.3s ease' }} />
                                </div>
                              </div>
                            )}

                            {/* Due Date & Time Log Meta */}
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: '0.68rem', color: 'var(--text-muted)', paddingTop: '2px' }}>
                              {t.dueDate ? (
                                <div style={{ display: 'flex', alignItems: 'center', gap: '3px', fontWeight: 700, color: isOverdue ? '#ef4444' : 'var(--text-muted)' }}>
                                  <Calendar size={11} />
                                  <span>Due: {new Date(t.dueDate).toLocaleDateString()}</span>
                                </div>
                              ) : <span />}

                              {t.estimatedHours > 0 && (
                                <div style={{ display: 'flex', alignItems: 'center', gap: '2px', fontSize: '0.64rem', fontWeight: 600, color: 'var(--text-muted)' }}>
                                  <Clock size={10} />
                                  <span>Est: {t.estimatedHours}h</span>
                                </div>
                              )}
                            </div>

                            {/* Footer: One-Tap Quick Advance & Move Select */}
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: '3px', paddingTop: '0.4rem', borderTop: '1px solid var(--border-light)' }}>
                              {t.status !== 'Done' ? (
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    const nextMap = { 'Backlog': 'To Do', 'To Do': 'In Progress', 'In Progress': 'In Review', 'In Review': 'Done' };
                                    if (nextMap[t.status]) handleStatusChange(t, nextMap[t.status]);
                                  }}
                                  style={{ background: '#eff6ff', border: '1px solid #bfdbfe', color: '#2563eb', fontSize: '0.64rem', fontWeight: 800, padding: '2px 8px', borderRadius: '4px', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: '3px' }}
                                  title={`Advance to ${t.status === 'In Review' ? 'Done' : 'Next Stage'}`}
                                >
                                  <span>{t.status === 'In Review' ? '✓ Mark Done' : `➔ ${t.status === 'Backlog' ? 'To Do' : t.status === 'To Do' ? 'In Progress' : 'In Review'}`}</span>
                                </button>
                              ) : (
                                <span style={{ fontSize: '0.64rem', color: '#16a34a', fontWeight: 800, display: 'inline-flex', alignItems: 'center', gap: '2px' }}>
                                  <CheckCircle2 size={12} /> Done
                                </span>
                              )}

                              {/* Status Quick Shift Select */}
                              <select
                                value={t.status}
                                onClick={(e) => e.stopPropagation()}
                                onChange={(e) => handleStatusChange(t, e.target.value)}
                                style={{ fontSize: '0.65rem', padding: '1px 6px', borderRadius: '4px', border: '1px solid var(--border-light)', background: '#ffffff', cursor: 'pointer', fontWeight: 700 }}
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
                  <th style={{ padding: '0.65rem 0.85rem' }}>Assigned By</th>
                  <th style={{ padding: '0.65rem 0.85rem' }}>Assigned To</th>
                  <th style={{ padding: '0.65rem 0.85rem' }}>Project Ref</th>
                  <th style={{ padding: '0.65rem 0.85rem' }}>Hours Logged</th>
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
                    const assignerName = getAssignerName(t);
                    return (
                      <tr
                        key={t._id}
                        onClick={() => setSelectedTask(t)}
                        style={{ borderBottom: '1px solid var(--border-light)', cursor: 'pointer', transition: 'background 0.15s' }}
                      >
                        <td style={{ padding: '0.65rem 0.85rem', fontWeight: 700, color: 'var(--text-primary)' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                            <span>{t.title}</span>
                            {t.recurrence && t.recurrence.isRecurring && (
                              <span style={{ fontSize: '0.6rem', fontWeight: 800, color: '#7c3aed', background: '#f3e8ff', padding: '1px 5px', borderRadius: '4px' }}>
                                🔄 {t.recurrence.frequency}
                              </span>
                            )}
                          </div>
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
                        <td style={{ padding: '0.65rem 0.85rem', fontWeight: 700, color: '#475569' }}>
                          {assignerName}
                        </td>
                        <td style={{ padding: '0.65rem 0.85rem' }}>
                          <div style={{ display: 'flex', gap: '3px', flexWrap: 'wrap' }}>
                            {(t.assignees || []).map((a) => (
                              <span key={a._id || a} style={{ fontSize: '0.65rem', fontWeight: 700, background: '#eff6ff', color: '#2563eb', padding: '1px 6px', borderRadius: '4px' }}>
                                {typeof a === 'object' ? (a.name || a.username) : 'Staff'}
                              </span>
                            ))}
                          </div>
                        </td>
                        <td style={{ padding: '0.65rem 0.85rem', color: '#2563eb', fontWeight: 700 }}>
                          {t.projectRef || '-'}
                        </td>
                        <td style={{ padding: '0.65rem 0.85rem', fontWeight: 600 }}>
                          {calculateTotalLoggedHours(t.timeLogs)}h {t.estimatedHours ? `/ ${t.estimatedHours}h` : ''}
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

        ) : activeView === 'timeline' ? (

          /* ════ VIEW 3: GANTT CHART & TIMELINE VIEW ════ */
          <div className="glass-panel" style={{ height: '100%', borderRadius: '12px', overflow: 'auto', background: '#ffffff', padding: '1rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.5rem' }}>
              <div>
                <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: 800, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <CalendarRange size={18} color="#2563eb" />
                  <span>14-Day Gantt Schedule &amp; Production Timeline</span>
                </h3>
                <p style={{ margin: '2px 0 0', fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                  Interactive visual timeline showing start dates, due dates, and real-time sub-task completion progress.
                </p>
              </div>
            </div>

            {/* Timeline Table */}
            <div style={{ flex: 1, minHeight: 0, overflowX: 'auto', overflowY: 'auto', border: '1px solid var(--border-light)', borderRadius: '10px' }}>
              {(() => {
                const today = new Date();
                const calendarDays = Array.from({ length: 14 }).map((_, i) => {
                  const d = new Date(today);
                  d.setDate(today.getDate() + i);
                  return d;
                });

                return (
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.75rem', minWidth: 1000 }}>
                    <thead>
                      <tr style={{ background: '#f8fafc', borderBottom: '1px solid var(--border-light)' }}>
                        <th style={{ width: 280, padding: '0.6rem 0.8rem', textAlign: 'left', color: 'var(--text-muted)', position: 'sticky', left: 0, background: '#f8fafc', zIndex: 2 }}>
                          Task &amp; Assignees
                        </th>
                        {calendarDays.map((date, idx) => {
                          const isToday = idx === 0;
                          return (
                            <th key={idx} style={{ padding: '0.5rem 0.3rem', textAlign: 'center', borderLeft: '1px solid var(--border-light)', background: isToday ? '#eff6ff' : '#f8fafc' }}>
                              <div style={{ fontSize: '0.62rem', color: isToday ? '#2563eb' : 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 800 }}>
                                {date.toLocaleDateString('en-US', { weekday: 'short' })}
                              </div>
                              <div style={{ fontSize: '0.78rem', fontWeight: 800, color: isToday ? '#1d4ed8' : 'var(--text-primary)' }}>
                                {date.getDate()} {date.toLocaleDateString('en-US', { month: 'short' })}
                              </div>
                            </th>
                          );
                        })}
                      </tr>
                    </thead>
                    <tbody>
                      {filteredTasks.length === 0 ? (
                        <tr>
                          <td colSpan={15} style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-muted)' }}>
                            No tasks scheduled in timeline.
                          </td>
                        </tr>
                      ) : (
                        filteredTasks.map((t) => {
                          const pri = getPriorityBadge(t.priority);
                          const totalCheck = (t.checklist || []).length;
                          const completedCheck = (t.checklist || []).filter((c) => c.completed).length;
                          const progressPct = totalCheck > 0 ? Math.round((completedCheck / totalCheck) * 100) : (t.status === 'Done' ? 100 : 25);

                          // Calculate start day index and duration span
                          const created = t.createdAt ? new Date(t.createdAt) : today;
                          const due = t.dueDate ? new Date(t.dueDate) : new Date(today.getTime() + 86400000 * 3);
                          
                          let startIdx = calendarDays.findIndex(d => d.toDateString() === created.toDateString());
                          if (startIdx < 0) startIdx = 0;

                          let endIdx = calendarDays.findIndex(d => d.toDateString() === due.toDateString());
                          if (endIdx < 0) endIdx = Math.min(startIdx + 2, 13);
                          const spanDays = Math.max(1, endIdx - startIdx + 1);

                          return (
                            <tr key={t._id} onClick={() => setSelectedTask(t)} style={{ borderBottom: '1px solid var(--border-light)', cursor: 'pointer' }}>
                              {/* Task Info Cell */}
                              <td style={{ padding: '0.6rem 0.8rem', position: 'sticky', left: 0, background: '#ffffff', zIndex: 1, borderRight: '1px solid var(--border-light)' }}>
                                <div style={{ fontWeight: 700, color: 'var(--text-primary)', fontSize: '0.8rem', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: 260 }}>
                                  {t.title}
                                </div>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '4px', marginTop: '3px' }}>
                                  <span style={{ fontSize: '0.6rem', fontWeight: 800, padding: '1px 5px', borderRadius: '4px', background: pri.bg, color: pri.color }}>
                                    {t.priority.toUpperCase()}
                                  </span>
                                  <span style={{ fontSize: '0.6rem', fontWeight: 800, padding: '1px 5px', borderRadius: '4px', background: 'rgba(37,99,235,0.1)', color: '#2563eb' }}>
                                    {t.status}
                                  </span>
                                </div>
                              </td>

                              {/* Calendar Day Grid Cells */}
                              {calendarDays.map((_, dayIdx) => {
                                const isBarStart = dayIdx === startIdx;
                                const isInsideBar = dayIdx >= startIdx && dayIdx < (startIdx + spanDays);

                                return (
                                  <td key={dayIdx} style={{ borderLeft: '1px solid var(--border-light)', padding: '0.2rem', verticalAlign: 'middle', position: 'relative' }}>
                                    {isBarStart && (
                                      <div
                                        style={{
                                          position: 'absolute',
                                          top: '50%',
                                          transform: 'translateY(-50%)',
                                          left: '4px',
                                          width: `calc(${spanDays * 100}% + ${(spanDays - 1) * 2}px - 8px)`,
                                          height: '24px',
                                          borderRadius: '6px',
                                          background: t.status === 'Done' ? 'linear-gradient(90deg, #16a34a, #22c55e)' : t.status === 'In Progress' ? 'linear-gradient(90deg, #0284c7, #38bdf8)' : 'linear-gradient(90deg, #2563eb, #60a5fa)',
                                          color: '#ffffff',
                                          padding: '0 8px',
                                          display: 'flex',
                                          alignItems: 'center',
                                          justifyContent: 'space-between',
                                          boxShadow: '0 2px 6px rgba(37,99,235,0.2)',
                                          zIndex: 5,
                                          fontSize: '0.65rem',
                                          fontWeight: 800
                                        }}
                                      >
                                        <span style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                          {t.title}
                                        </span>
                                        <span style={{ background: 'rgba(255,255,255,0.25)', padding: '1px 5px', borderRadius: '4px', fontSize: '0.6rem' }}>
                                          {progressPct}%
                                        </span>
                                      </div>
                                    )}
                                  </td>
                                );
                              })}
                            </tr>
                          );
                        })
                      )}
                    </tbody>
                  </table>
                );
              })()}
            </div>
          </div>

        ) : activeView === 'leaderboard' ? (

          /* ════ VIEW 4: STAFF PRODUCTIVITY LEADERBOARD ════ */
          <div className="glass-panel" style={{ height: '100%', borderRadius: '12px', overflowY: 'auto', background: '#ffffff', padding: '1rem', display: 'flex', flexDirection: 'column', gap: '1.2rem' }}>
            
            {/* Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.5rem' }}>
              <div>
                <h3 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 800, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <Trophy size={20} color="#d97706" />
                  <span>Staff Productivity &amp; Performance Leaderboard</span>
                </h3>
                <p style={{ margin: '2px 0 0', fontSize: '0.74rem', color: 'var(--text-muted)' }}>
                  Real-time workforce rankings calculated from task completions, billable hours logged, and on-time performance.
                </p>
              </div>
            </div>

            {/* Compute Leaderboard Statistics */}
            {(() => {
              const staffStats = allUsers.map((user) => {
                const uId = String(user._id);
                const userTasks = tasks.filter((t) =>
                  (t.assignees || []).some((a) => String(typeof a === 'object' ? (a._id || a.id) : a) === uId)
                );
                const completed = userTasks.filter((t) => t.status === 'Done');

                let totalLoggedHours = 0;
                tasks.forEach((t) => {
                  (t.timeLogs || []).forEach((log) => {
                    if (String(log.userId) === uId || log.userName === user.name) {
                      totalLoggedHours += (log.hours || 0);
                    }
                  });
                });

                const onTimeCount = completed.filter((t) => {
                  if (!t.dueDate) return true;
                  return new Date(t.updatedAt || t.createdAt) <= new Date(t.dueDate);
                }).length;

                const onTimeRate = completed.length > 0 ? Math.round((onTimeCount / completed.length) * 100) : 100;
                const score = (completed.length * 15) + (totalLoggedHours * 3) + Math.round(onTimeRate * 0.5);

                return {
                  user,
                  totalAssigned: userTasks.length,
                  completedCount: completed.length,
                  hoursLogged: totalLoggedHours.toFixed(1),
                  onTimeRate,
                  score
                };
              }).sort((a, b) => b.score - a.score);

              const topThree = staffStats.slice(0, 3);

              return (
                <>
                  {/* Top 3 Winners Podium Cards */}
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '1rem' }}>
                    
                    {topThree[0] && (
                      <div style={{ padding: '1.2rem', borderRadius: '14px', background: 'linear-gradient(135deg, #fefce8 0%, #fef3c7 100%)', border: '2px solid #fde047', boxShadow: '0 8px 20px rgba(234,179,8,0.18)', display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center', position: 'relative' }}>
                        <div style={{ position: 'absolute', top: '-12px', background: '#eab308', color: '#fff', fontSize: '0.65rem', fontWeight: 900, padding: '2px 10px', borderRadius: '12px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                          🥇 1st Place Champion
                        </div>
                        <div style={{ width: 50, height: 50, borderRadius: '50%', background: '#f59e0b', color: '#fff', fontSize: '1.4rem', fontWeight: 900, display: 'flex', alignItems: 'center', justifyContent: 'center', marginTop: '6px', border: '3px solid #ffffff', boxShadow: '0 4px 10px rgba(0,0,0,0.1)' }}>
                          {(topThree[0].user.name || 'U').charAt(0)}
                        </div>
                        <h4 style={{ margin: '8px 0 2px', fontSize: '1rem', fontWeight: 800, color: '#78350f' }}>
                          {topThree[0].user.name || topThree[0].user.username}
                        </h4>
                        <div style={{ fontSize: '0.72rem', color: '#b45309', fontWeight: 600 }}>{topThree[0].user.email}</div>
                        <div style={{ display: 'flex', gap: '8px', marginTop: '12px' }}>
                          <span style={{ background: '#ffffff', color: '#92400e', padding: '3px 8px', borderRadius: '8px', fontSize: '0.7rem', fontWeight: 800 }}>
                            ✅ {topThree[0].completedCount} Done
                          </span>
                          <span style={{ background: '#ffffff', color: '#92400e', padding: '3px 8px', borderRadius: '8px', fontSize: '0.7rem', fontWeight: 800 }}>
                            ⏱️ {topThree[0].hoursLogged}h Logged
                          </span>
                        </div>
                        <div style={{ marginTop: '10px', fontSize: '1.1rem', fontWeight: 900, color: '#854d0e' }}>
                          🔥 {topThree[0].score} Pts
                        </div>
                      </div>
                    )}

                    {topThree[1] && (
                      <div style={{ padding: '1.2rem', borderRadius: '14px', background: 'linear-gradient(135deg, #f8fafc 0%, #e2e8f0 100%)', border: '2px solid #cbd5e1', boxShadow: '0 6px 16px rgba(100,116,139,0.15)', display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center', position: 'relative' }}>
                        <div style={{ position: 'absolute', top: '-12px', background: '#64748b', color: '#fff', fontSize: '0.65rem', fontWeight: 900, padding: '2px 10px', borderRadius: '12px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                          🥈 2nd Place
                        </div>
                        <div style={{ width: 46, height: 46, borderRadius: '50%', background: '#64748b', color: '#fff', fontSize: '1.2rem', fontWeight: 900, display: 'flex', alignItems: 'center', justifyContent: 'center', marginTop: '6px', border: '3px solid #ffffff' }}>
                          {(topThree[1].user.name || 'U').charAt(0)}
                        </div>
                        <h4 style={{ margin: '8px 0 2px', fontSize: '0.95rem', fontWeight: 800, color: '#1e293b' }}>
                          {topThree[1].user.name || topThree[1].user.username}
                        </h4>
                        <div style={{ fontSize: '0.72rem', color: '#64748b', fontWeight: 600 }}>{topThree[1].user.email}</div>
                        <div style={{ display: 'flex', gap: '8px', marginTop: '12px' }}>
                          <span style={{ background: '#ffffff', color: '#334155', padding: '3px 8px', borderRadius: '8px', fontSize: '0.7rem', fontWeight: 800 }}>
                            ✅ {topThree[1].completedCount} Done
                          </span>
                          <span style={{ background: '#ffffff', color: '#334155', padding: '3px 8px', borderRadius: '8px', fontSize: '0.7rem', fontWeight: 800 }}>
                            ⏱️ {topThree[1].hoursLogged}h Logged
                          </span>
                        </div>
                        <div style={{ marginTop: '10px', fontSize: '1rem', fontWeight: 900, color: '#334155' }}>
                          ⚡ {topThree[1].score} Pts
                        </div>
                      </div>
                    )}

                    {topThree[2] && (
                      <div style={{ padding: '1.2rem', borderRadius: '14px', background: 'linear-gradient(135deg, #fff7ed 0%, #ffedd5 100%)', border: '2px solid #fdba74', boxShadow: '0 6px 16px rgba(194,65,12,0.15)', display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center', position: 'relative' }}>
                        <div style={{ position: 'absolute', top: '-12px', background: '#c2410c', color: '#fff', fontSize: '0.65rem', fontWeight: 900, padding: '2px 10px', borderRadius: '12px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                          🥉 3rd Place
                        </div>
                        <div style={{ width: 44, height: 44, borderRadius: '50%', background: '#ea580c', color: '#fff', fontSize: '1.1rem', fontWeight: 900, display: 'flex', alignItems: 'center', justifyContent: 'center', marginTop: '6px', border: '3px solid #ffffff' }}>
                          {(topThree[2].user.name || 'U').charAt(0)}
                        </div>
                        <h4 style={{ margin: '8px 0 2px', fontSize: '0.95rem', fontWeight: 800, color: '#7c2d12' }}>
                          {topThree[2].user.name || topThree[2].user.username}
                        </h4>
                        <div style={{ fontSize: '0.72rem', color: '#9a3412', fontWeight: 600 }}>{topThree[2].user.email}</div>
                        <div style={{ display: 'flex', gap: '8px', marginTop: '12px' }}>
                          <span style={{ background: '#ffffff', color: '#9a3412', padding: '3px 8px', borderRadius: '8px', fontSize: '0.7rem', fontWeight: 800 }}>
                            ✅ {topThree[2].completedCount} Done
                          </span>
                          <span style={{ background: '#ffffff', color: '#9a3412', padding: '3px 8px', borderRadius: '8px', fontSize: '0.7rem', fontWeight: 800 }}>
                            ⏱️ {topThree[2].hoursLogged}h Logged
                          </span>
                        </div>
                        <div style={{ marginTop: '10px', fontSize: '1rem', fontWeight: 900, color: '#9a3412' }}>
                          ⭐ {topThree[2].score} Pts
                        </div>
                      </div>
                    )}

                  </div>

                  {/* Full Staff Rankings Table */}
                  <div style={{ border: '1px solid var(--border-light)', borderRadius: '10px', overflow: 'hidden' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.78rem' }}>
                      <thead>
                        <tr style={{ background: '#f8fafc', borderBottom: '1px solid var(--border-light)', textAlign: 'left', color: 'var(--text-muted)' }}>
                          <th style={{ padding: '0.65rem 0.85rem' }}>Rank</th>
                          <th style={{ padding: '0.65rem 0.85rem' }}>Staff User</th>
                          <th style={{ padding: '0.65rem 0.85rem' }}>Completed Tasks</th>
                          <th style={{ padding: '0.65rem 0.85rem' }}>Hours Logged</th>
                          <th style={{ padding: '0.65rem 0.85rem' }}>On-Time Rate</th>
                          <th style={{ padding: '0.65rem 0.85rem', textAlign: 'right' }}>Performance Score</th>
                        </tr>
                      </thead>
                      <tbody>
                        {staffStats.map((item, index) => {
                          const rankPill = index === 0 ? '🥇 #1' : index === 1 ? '🥈 #2' : index === 2 ? '🥉 #3' : `#${index + 1}`;
                          return (
                            <tr key={item.user._id} style={{ borderBottom: '1px solid var(--border-light)' }}>
                              <td style={{ padding: '0.65rem 0.85rem', fontWeight: 900, color: index < 3 ? '#2563eb' : 'var(--text-muted)' }}>
                                {rankPill}
                              </td>
                              <td style={{ padding: '0.65rem 0.85rem', fontWeight: 700, color: 'var(--text-primary)' }}>
                                {item.user.name || item.user.username}
                              </td>
                              <td style={{ padding: '0.65rem 0.85rem', fontWeight: 700 }}>
                                <span style={{ color: '#16a34a' }}>{item.completedCount}</span> / {item.totalAssigned} tasks
                              </td>
                              <td style={{ padding: '0.65rem 0.85rem', fontWeight: 700, color: '#2563eb' }}>
                                {item.hoursLogged} hrs
                              </td>
                              <td style={{ padding: '0.65rem 0.85rem' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                  <div style={{ flex: 1, height: '6px', background: '#e2e8f0', borderRadius: '4px', overflow: 'hidden', maxWidth: 80 }}>
                                    <div style={{ width: `${item.onTimeRate}%`, height: '100%', background: item.onTimeRate >= 80 ? '#16a34a' : '#d97706' }} />
                                  </div>
                                  <span style={{ fontWeight: 800, fontSize: '0.72rem' }}>{item.onTimeRate}%</span>
                                </div>
                              </td>
                              <td style={{ padding: '0.65rem 0.85rem', textAlign: 'right', fontWeight: 900, color: '#1e293b', fontSize: '0.85rem' }}>
                                {item.score} pts
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </>
              );
            })()}

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
          <div className="glass-panel" style={{ width: '100%', maxWidth: 620, maxHeight: '90vh', borderRadius: '16px', overflow: 'hidden', display: 'flex', flexDirection: 'column', animation: 'slideUp 0.2s ease-out', background: '#ffffff' }}>
            
            <div style={{ padding: '1.1rem 1.4rem', borderBottom: '1px solid var(--border-light)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'linear-gradient(135deg, #0f172a 0%, #1e293b 100%)', color: '#fff' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                <CheckSquare size={20} color="#38bdf8" />
                <h3 style={{ margin: 0, fontSize: '1.05rem', fontWeight: 800, color: '#fff' }}>
                  Create &amp; Assign New Task
                </h3>
              </div>
              <button onClick={() => setShowCreateModal(false)} style={{ background: 'rgba(255,255,255,0.1)', border: 'none', color: '#fff', width: 28, height: 28, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
                <X size={16} />
              </button>
            </div>

            <form onSubmit={handleCreateTaskSubmit} style={{ padding: '1.2rem 1.4rem', overflowY: 'auto', flex: 1, display: 'flex', flexDirection: 'column', gap: '0.9rem' }}>
              
              {/* Feature 4: Task Template Library SOP Picker */}
              <div style={{ background: '#f8fafc', padding: '0.75rem', borderRadius: '10px', border: '1px dashed #bfdbfe' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '4px' }}>
                  <label style={{ fontSize: '0.78rem', fontWeight: 800, color: '#1d4ed8', display: 'flex', alignItems: 'center', gap: '4px' }}>
                    <Wand2 size={14} color="#2563eb" />
                    <span>📚 Task Template SOP Library</span>
                  </label>
                  {selectedTemplateId && (
                    <span style={{ fontSize: '0.65rem', color: '#16a34a', fontWeight: 800 }}>
                      ✓ Template Loaded ({templateChecklist.length} SOP steps)
                    </span>
                  )}
                </div>
                <select
                  value={selectedTemplateId}
                  onChange={(e) => handleApplyTemplate(e.target.value)}
                  style={{ width: '100%', padding: '0.5rem', fontSize: '0.78rem', fontWeight: 700, borderRadius: '6px', border: '1px solid #bfdbfe', background: '#ffffff', color: '#1e293b' }}
                >
                  <option value="">Select SOP Template to Auto-Fill (Optional)...</option>
                  {TASK_TEMPLATES.map((tmpl) => (
                    <option key={tmpl.id} value={tmpl.id}>
                      {tmpl.name} ({tmpl.category})
                    </option>
                  ))}
                </select>
              </div>

              {/* Task Title & Feature 5: Voice-to-Task */}
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                  <label style={{ fontSize: '0.78rem', fontWeight: 700, color: 'var(--text-primary)' }}>
                    Task Title *
                  </label>
                  <button
                    type="button"
                    onClick={() => startVoiceInput('title')}
                    style={{
                      background: isListening && voiceTarget === 'title' ? '#fee2e2' : '#eff6ff',
                      border: `1px solid ${isListening && voiceTarget === 'title' ? '#fca5a5' : '#bfdbfe'}`,
                      color: isListening && voiceTarget === 'title' ? '#dc2626' : '#2563eb',
                      padding: '2px 8px',
                      borderRadius: '12px',
                      fontSize: '0.68rem',
                      fontWeight: 800,
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '4px'
                    }}
                  >
                    {isListening && voiceTarget === 'title' ? <MicOff size={11} className="pulse-mic" /> : <Mic size={11} />}
                    <span>{isListening && voiceTarget === 'title' ? '🔴 Listening... Speak Title' : '🎤 Voice Input'}</span>
                  </button>
                </div>
                <input
                  type="text"
                  placeholder="e.g. Prepare Fabric Printing Output Batch #102"
                  value={newTitle}
                  onChange={(e) => setNewTitle(e.target.value)}
                  required
                  style={{ width: '100%', padding: '0.55rem', fontSize: '0.82rem', borderRadius: '6px', border: '1px solid var(--border-light)', background: 'var(--bg-input)' }}
                />
              </div>

              {/* Description & Voice Input */}
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                  <label style={{ fontSize: '0.78rem', fontWeight: 700, color: 'var(--text-primary)' }}>
                    Description &amp; Work Instructions
                  </label>
                  <button
                    type="button"
                    onClick={() => startVoiceInput('desc')}
                    style={{
                      background: isListening && voiceTarget === 'desc' ? '#fee2e2' : '#eff6ff',
                      border: `1px solid ${isListening && voiceTarget === 'desc' ? '#fca5a5' : '#bfdbfe'}`,
                      color: isListening && voiceTarget === 'desc' ? '#dc2626' : '#2563eb',
                      padding: '2px 8px',
                      borderRadius: '12px',
                      fontSize: '0.68rem',
                      fontWeight: 800,
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '4px'
                    }}
                  >
                    {isListening && voiceTarget === 'desc' ? <MicOff size={11} className="pulse-mic" /> : <Mic size={11} />}
                    <span>{isListening && voiceTarget === 'desc' ? '🔴 Listening... Speak Details' : '🎤 Voice Input'}</span>
                  </button>
                </div>
                <textarea
                  rows={3}
                  placeholder="Enter detailed task instructions or dictate using voice input..."
                  value={newDesc}
                  onChange={(e) => setNewDesc(e.target.value)}
                  style={{ width: '100%', padding: '0.55rem', fontSize: '0.8rem', borderRadius: '6px', border: '1px solid var(--border-light)', background: 'var(--bg-input)' }}
                />
              </div>

              {/* Feature 8: Automated Recurring Task Setup */}
              <div style={{ background: '#fcf5ff', padding: '0.7rem 0.85rem', borderRadius: '10px', border: '1px solid #e9d5ff', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.5rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <input
                    type="checkbox"
                    id="recurringTaskToggle"
                    checked={isRecurring}
                    onChange={(e) => setIsRecurring(e.target.checked)}
                    style={{ width: 16, height: 16, cursor: 'pointer' }}
                  />
                  <label htmlFor="recurringTaskToggle" style={{ fontSize: '0.78rem', fontWeight: 800, color: '#6b21a8', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px' }}>
                    <Repeat size={14} color="#7c3aed" />
                    <span>🔄 Automated Recurring Task Schedule</span>
                  </label>
                </div>

                {isRecurring && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                    <span style={{ fontSize: '0.72rem', fontWeight: 700, color: '#7c3aed' }}>Repeat Frequency:</span>
                    <select
                      value={recurrenceFreq}
                      onChange={(e) => setRecurrenceFreq(e.target.value)}
                      style={{ fontSize: '0.75rem', fontWeight: 800, padding: '2px 8px', borderRadius: '6px', border: '1px solid #ddd6fe', background: '#ffffff', color: '#6b21a8', cursor: 'pointer' }}
                    >
                      <option value="daily">📅 Daily (Every Morning)</option>
                      <option value="weekly">📅 Weekly (Every Monday)</option>
                      <option value="monthly">📅 Monthly (1st of Month)</option>
                    </select>
                  </div>
                )}
              </div>

              {/* Assigned By & Priority */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.85rem' }}>
                <div>
                  <label style={{ fontSize: '0.78rem', fontWeight: 700, color: 'var(--text-primary)', display: 'block', marginBottom: '4px' }}>
                    Assigned By (Creator)
                  </label>
                  <div style={{ padding: '0.55rem', fontSize: '0.8rem', fontWeight: 700, borderRadius: '6px', background: '#f1f5f9', border: '1px solid var(--border-light)', color: '#2563eb', display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <User size={14} />
                    <span>{myName}</span>
                  </div>
                </div>

                <div>
                  <label style={{ fontSize: '0.78rem', fontWeight: 700, color: 'var(--text-primary)', display: 'block', marginBottom: '4px' }}>
                    Priority
                  </label>
                  <select
                    value={newPriority}
                    onChange={(e) => setNewPriority(e.target.value)}
                    style={{ width: '100%', padding: '0.55rem', fontSize: '0.8rem', borderRadius: '6px', border: '1px solid var(--border-light)', background: 'var(--bg-input)' }}
                  >
                    <option value="low">Low</option>
                    <option value="medium">Medium</option>
                    <option value="high">High</option>
                    <option value="urgent">Urgent</option>
                  </select>
                </div>
              </div>

              {/* Assigned To Staff Selection Checkboxes */}
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                  <label style={{ fontSize: '0.78rem', fontWeight: 700, color: 'var(--text-primary)' }}>
                    Assigned To Staff Members ({selectedAssigneeIds.length} selected)
                  </label>
                  <div style={{ display: 'flex', gap: '0.4rem' }}>
                    <button type="button" onClick={handleSelectAllStaff} style={{ background: 'none', border: 'none', color: '#2563eb', fontSize: '0.72rem', fontWeight: 800, cursor: 'pointer' }}>
                      Select All
                    </button>
                    <span style={{ color: 'var(--text-muted)', fontSize: '0.72rem' }}>|</span>
                    <button type="button" onClick={handleDeselectAllStaff} style={{ background: 'none', border: 'none', color: '#ef4444', fontSize: '0.72rem', fontWeight: 800, cursor: 'pointer' }}>
                      Deselect All
                    </button>
                  </div>
                </div>

                <div style={{ position: 'relative', marginBottom: '0.4rem' }}>
                  <Search size={12} style={{ position: 'absolute', left: '8px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
                  <input
                    type="text"
                    placeholder="Search staff members..."
                    value={staffSearch}
                    onChange={(e) => setStaffSearch(e.target.value)}
                    style={{ width: '100%', paddingLeft: '26px', fontSize: '0.74rem', height: '28px', background: '#f8fafc', border: '1px solid var(--border-light)', borderRadius: '6px', boxSizing: 'border-box' }}
                  />
                </div>

                <div style={{ maxHeight: 150, overflowY: 'auto', border: '1px solid var(--border-light)', borderRadius: '8px', padding: '0.4rem', display: 'flex', flexDirection: 'column', gap: '3px', background: '#ffffff' }}>
                  {allUsers
                    .filter((u) => {
                      const term = staffSearch.toLowerCase().trim();
                      if (!term) return true;
                      return (u.name || '').toLowerCase().includes(term) || (u.email || '').toLowerCase().includes(term);
                    })
                    .map((u) => {
                      const isChecked = selectedAssigneeIds.includes(String(u._id));
                      return (
                        <div
                          key={u._id}
                          onClick={() => toggleAssigneeSelection(String(u._id))}
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            padding: '0.35rem 0.55rem',
                            borderRadius: '6px',
                            background: isChecked ? '#eff6ff' : 'transparent',
                            border: isChecked ? '1px solid #bfdbfe' : '1px solid transparent',
                            cursor: 'pointer'
                          }}
                        >
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                            <input type="checkbox" checked={isChecked} onChange={() => {}} style={{ cursor: 'pointer' }} />
                            <span style={{ fontSize: '0.78rem', fontWeight: 700, color: 'var(--text-primary)' }}>{u.name || u.username}</span>
                          </div>
                          <span style={{ fontSize: '0.68rem', color: 'var(--text-muted)' }}>{u.email}</span>
                        </div>
                      );
                    })}
                </div>
              </div>

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

              <button
                type="submit"
                disabled={creating}
                className="btn-primary"
                style={{ marginTop: '0.5rem', padding: '0.6rem', fontSize: '0.85rem', borderRadius: '8px' }}
              >
                {creating ? 'Creating Task...' : 'Create & Assign Task'}
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
                  <label style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--text-muted)', display: 'block', marginBottom: '3px' }}>Assigned By</label>
                  <div style={{ fontSize: '0.8rem', fontWeight: 700, color: '#475569' }}>
                    {getAssignerName(selectedTask)}
                  </div>
                </div>

                <div>
                  <label style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--text-muted)', display: 'block', marginBottom: '3px' }}>Assigned To</label>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                    {allUsers.map((u) => {
                      const isAssigned = (selectedTask.assignees || []).some(
                        (a) => String(typeof a === 'object' ? (a._id || a.id) : a) === String(u._id)
                      );
                      return (
                        <div
                          key={u._id}
                          onClick={() => {
                            const currentIds = (selectedTask.assignees || []).map((a) => String(typeof a === 'object' ? (a._id || a.id) : a));
                            const updated = isAssigned ? currentIds.filter((id) => id !== String(u._id)) : [...currentIds, String(u._id)];
                            handleUpdateAssignees(selectedTask, updated);
                          }}
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '6px',
                            padding: '3px 6px',
                            borderRadius: '5px',
                            background: isAssigned ? '#eff6ff' : '#ffffff',
                            border: isAssigned ? '1px solid #bfdbfe' : '1px solid var(--border-light)',
                            cursor: 'pointer'
                          }}
                        >
                          <input type="checkbox" checked={isAssigned} onChange={() => {}} style={{ cursor: 'pointer' }} />
                          <span style={{ fontSize: '0.75rem', fontWeight: isAssigned ? 700 : 500, color: isAssigned ? '#2563eb' : 'var(--text-primary)' }}>
                            {u.name || u.username}
                          </span>
                        </div>
                      );
                    })}
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
