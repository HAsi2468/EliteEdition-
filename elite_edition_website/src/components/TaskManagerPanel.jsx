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
  Star,
  Download,
  ChevronLeft,
  ChevronDown
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
  const [activeView, setActiveView] = useState('kanban'); // 'kanban' | 'list' | 'calendar' | 'timeline' | 'leaderboard' | 'timesheets'

  // TaskOPad Scope Tabs State
  const [taskScope, setTaskScope] = useState('all'); // 'all' | 'my_tasks' | 'delegated' | 'today' | 'overdue' | 'completed'

  // TaskOPad Interactive Calendar State
  const [calendarMonth, setCalendarMonth] = useState(new Date());

  // TaskOPad Work Logging Modal & Form State
  const [showLogWorkModal, setShowLogWorkModal] = useState(false);
  const [manualLogHours, setManualLogHours] = useState('');
  const [manualLogDesc, setManualLogDesc] = useState('');
  const [manualLogBillable, setManualLogBillable] = useState(true);
  const [loggingTime, setLoggingTime] = useState(false);

  // Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [assigneeFilter, setAssigneeFilter] = useState('all');
  const [priorityFilter, setPriorityFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');

  // Mobile Dropdowns & Control State
  const [showMobileViewMenu, setShowMobileViewMenu] = useState(false);
  const [showMobileScopeMenu, setShowMobileScopeMenu] = useState(false);
  const [showMobileFilterMenu, setShowMobileFilterMenu] = useState(false);

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

  // Task Attachments (stored in Cloudflare R2)
  const [newAttachments, setNewAttachments] = useState([]); // [{ fileName, fileUrl, fileSize, fileType }]
  const [uploadingAttachment, setUploadingAttachment] = useState(false);
  const [drawerUploadingAttachment, setDrawerUploadingAttachment] = useState(false);
  const fileInputRef = useRef(null);
  const drawerFileInputRef = useRef(null);

  const formatFileSize = (bytes) => {
    if (!bytes || bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
  };

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

  const isMasterAdmin = Boolean(
    (currentUser?.role || '').toLowerCase() === 'admin' ||
    currentUser?.isMainAdmin ||
    (currentUser?.username || '').toLowerCase() === 'admin' ||
    (currentUser?.email || '').toLowerCase() === 'harshitsidapara2468@gmail.com'
  );
  const isAdmin = isMasterAdmin;

  const isTaskAssignedToMe = (t) => {
    return (t?.assignees || []).some((a) => {
      const aId = String(typeof a === 'object' ? (a?._id || a?.id) : a);
      return aId === String(myId);
    });
  };

  const isTaskCreatedByMe = (t) => {
    const cId = String(typeof t?.createdBy === 'object' ? (t?.createdBy?._id || t?.createdBy?.id) : (t?.createdBy || ''));
    return cId === String(myId);
  };

  const isTaskVisible = (t) => {
    if (isMasterAdmin) return true;
    return isTaskAssignedToMe(t) || isTaskCreatedByMe(t);
  };

  useEffect(() => {
    fetchInitialData();
  }, []);

  // ── REAL-TIME SOCKET EVENT LISTENERS ──
  useEffect(() => {
    if (!socket) return;

    const handleTaskCreated = (newTask) => {
      if (!isTaskVisible(newTask)) return;
      setTasks((prev) => {
        if (prev.some((t) => String(t._id) === String(newTask._id))) return prev;
        return [newTask, ...prev];
      });
    };

    const handleTaskUpdated = (updatedTask) => {
      setTasks((prev) => {
        if (!isTaskVisible(updatedTask)) {
          return prev.filter((t) => String(t._id) !== String(updatedTask._id));
        }
        const exists = prev.some((t) => String(t._id) === String(updatedTask._id));
        if (exists) {
          return prev.map((t) => (String(t._id) === String(updatedTask._id) ? updatedTask : t));
        }
        return [updatedTask, ...prev];
      });
      setSelectedTask((prev) => {
        if (prev && String(prev._id) === String(updatedTask._id)) {
          return isTaskVisible(updatedTask) ? updatedTask : null;
        }
        return prev;
      });
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
  }, [socket, isMasterAdmin, myId]);

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
        const rawTasks = tasksRes.data;
        setTasks(isMasterAdmin ? rawTasks : rawTasks.filter(isTaskVisible));
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

  // Cloudflare R2 Attachment Handlers
  const handleUploadNewTaskAttachments = async (e) => {
    const files = Array.from(e.target.files || []);
    if (!files.length) return;

    setUploadingAttachment(true);
    try {
      for (const file of files) {
        const uploadRes = await api.uploadTaskAttachment(file);
        if (uploadRes && (uploadRes.url || uploadRes.fileUrl)) {
          const fileUrl = uploadRes.url || uploadRes.fileUrl;
          const fileName = file.name;
          const fileSize = file.size;
          const fileType = file.type || 'document';
          setNewAttachments((prev) => [
            ...prev,
            { fileName, fileUrl, fileSize, fileType }
          ]);
        }
      }
    } catch (err) {
      console.error('Failed to upload attachment to R2:', err);
      alert('Failed to upload attachment to Cloudflare R2: ' + err.message);
    } finally {
      setUploadingAttachment(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleRemoveNewAttachment = (indexToRemove) => {
    setNewAttachments((prev) => prev.filter((_, idx) => idx !== indexToRemove));
  };

  const handleUploadDrawerAttachment = async (e) => {
    if (!selectedTask) return;
    const files = Array.from(e.target.files || []);
    if (!files.length) return;

    setDrawerUploadingAttachment(true);
    try {
      for (const file of files) {
        const uploadRes = await api.uploadTaskAttachment(file);
        if (uploadRes && (uploadRes.url || uploadRes.fileUrl)) {
          const fileUrl = uploadRes.url || uploadRes.fileUrl;
          const fileName = file.name;
          const fileSize = file.size;
          const fileType = file.type || 'document';

          const res = await api.addTaskAttachment(selectedTask._id, {
            fileName,
            fileUrl,
            fileSize,
            fileType,
            userId: myId,
            userName: myName
          });

          if (res.success && res.data) {
            setSelectedTask(res.data);
            setTasks((prev) => prev.map((t) => (String(t._id) === String(selectedTask._id) ? res.data : t)));
          }
        }
      }
    } catch (err) {
      console.error('Failed to upload attachment to R2:', err);
      alert('Failed to upload attachment to Cloudflare R2: ' + err.message);
    } finally {
      setDrawerUploadingAttachment(false);
      if (drawerFileInputRef.current) drawerFileInputRef.current.value = '';
    }
  };

  const handleDeleteDrawerAttachment = async (attachmentId) => {
    if (!selectedTask || !attachmentId) return;
    if (!window.confirm('Are you sure you want to delete this attachment?')) return;

    try {
      const res = await api.deleteTaskAttachment(selectedTask._id, attachmentId);
      if (res.success && res.data) {
        setSelectedTask(res.data);
        setTasks((prev) => prev.map((t) => (String(t._id) === String(selectedTask._id) ? res.data : t)));
      }
    } catch (err) {
      console.error('Failed to delete attachment:', err);
      alert('Failed to delete attachment: ' + err.message);
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
        priority: newPriority,
        status: newStatus,
        projectRef: newProjectRef.trim(),
        clientName: newClientName.trim(),
        dueDate: newDueDate || undefined,
        estimatedHours: parseFloat(newEstHours) || 0,
        assignees: selectedAssigneeIds && selectedAssigneeIds.length > 0 ? selectedAssigneeIds : (myId ? [myId] : []),
        attachments: newAttachments,
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
    setNewAttachments([]);
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

  // Tasks filtered by role visibility (defense in depth)
  const visibleTasks = React.useMemo(() => {
    return isMasterAdmin ? tasks : tasks.filter(isTaskVisible);
  }, [tasks, isMasterAdmin, myId]);

  // TaskOPad Scope Badge Counters
  const allCount = visibleTasks.length;
  const myTasksCount = visibleTasks.filter((t) => isTaskAssignedToMe(t)).length;
  const delegatedCount = visibleTasks.filter((t) => {
    const cId = String(typeof t.createdBy === 'object' ? (t.createdBy?._id || t.createdBy?.id) : (t.createdBy || ''));
    if (cId !== String(myId)) return false;
    return (t.assignees || []).some(
      (a) => String(typeof a === 'object' ? (a._id || a.id) : a) !== String(myId)
    );
  }).length;
  const todayCount = visibleTasks.filter((t) => {
    if (!t.dueDate || t.status === 'Done') return false;
    return new Date(t.dueDate).toDateString() === new Date().toDateString();
  }).length;
  const overdueCount = visibleTasks.filter((t) => {
    return t.dueDate && new Date(t.dueDate) < new Date() && t.status !== 'Done';
  }).length;
  const completedCount = visibleTasks.filter((t) => t.status === 'Done').length;

  // Filter tasks logic based on TaskOPad Scope, Priority, Status, Assignee, Search
  const filteredTasks = visibleTasks.filter((t) => {
    if (priorityFilter !== 'all' && t.priority !== priorityFilter) return false;
    if (statusFilter !== 'all' && t.status !== statusFilter) return false;
    if (assigneeFilter !== 'all') {
      const hasAssignee = (t.assignees || []).some((a) => {
        const aId = String(typeof a === 'object' ? (a._id || a.id) : a);
        return aId === assigneeFilter;
      });
      if (!hasAssignee) return false;
    }

    if (taskScope === 'my_tasks') {
      if (!isTaskAssignedToMe(t)) return false;
    } else if (taskScope === 'delegated') {
      const cId = String(typeof t.createdBy === 'object' ? (t.createdBy?._id || t.createdBy?.id) : (t.createdBy || ''));
      if (cId !== String(myId)) return false;
      const isDelegated = (t.assignees || []).some(
        (a) => String(typeof a === 'object' ? (a._id || a.id) : a) !== String(myId)
      );
      if (!isDelegated) return false;
    } else if (taskScope === 'today') {
      if (!t.dueDate) return false;
      if (new Date(t.dueDate).toDateString() !== new Date().toDateString()) return false;
    } else if (taskScope === 'overdue') {
      const isOverdue = t.dueDate && new Date(t.dueDate) < new Date() && t.status !== 'Done';
      if (!isOverdue) return false;
    } else if (taskScope === 'completed') {
      if (t.status !== 'Done') return false;
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

  // TaskOPad CSV Export Handler
  const handleExportCSV = () => {
    if (!filteredTasks.length) {
      alert('No tasks found to export with the current filters.');
      return;
    }

    const headers = [
      'Task ID',
      'Title',
      'Status',
      'Priority',
      'Project Ref',
      'Client',
      'Due Date',
      'Est Hours',
      'Logged Hours',
      'Subtasks Done',
      'Total Subtasks',
      'Assignees',
      'Created By',
      'Created At'
    ];

    const rows = filteredTasks.map((t) => {
      const assigneesStr = (t.assignees || [])
        .map((a) => (typeof a === 'object' ? (a.name || a.username) : 'Staff'))
        .join('; ');
      const checkTotal = (t.checklist || []).length;
      const checkDone = (t.checklist || []).filter((c) => c.completed).length;
      const logged = (t.timeLogs || []).reduce((sum, l) => sum + (l.hours || 0), 0).toFixed(1);
      const assigner = t.createdBy
        ? (typeof t.createdBy === 'object' ? (t.createdBy.name || t.createdBy.username) : 'Staff')
        : 'Admin';

      return [
        `"${t._id}"`,
        `"${(t.title || '').replace(/"/g, '""')}"`,
        `"${t.status}"`,
        `"${t.priority}"`,
        `"${(t.projectRef || '').replace(/"/g, '""')}"`,
        `"${(t.clientName || '').replace(/"/g, '""')}"`,
        `"${t.dueDate ? new Date(t.dueDate).toLocaleDateString() : ''}"`,
        t.estimatedHours || 0,
        logged,
        checkDone,
        checkTotal,
        `"${assigneesStr}"`,
        `"${assigner}"`,
        `"${t.createdAt ? new Date(t.createdAt).toLocaleDateString() : ''}"`
      ].join(',');
    });

    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `elite_tasks_${taskScope}_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // TaskOPad Manual Work Logging Handler
  const handleLogManualWork = async (e) => {
    e.preventDefault();
    if (!selectedTask) return;
    const numHours = parseFloat(manualLogHours);
    if (!manualLogHours || isNaN(numHours) || numHours <= 0) {
      alert('Please enter a valid positive number of hours.');
      return;
    }

    setLoggingTime(true);
    try {
      const res = await api.addTaskTimeLog(selectedTask._id, {
        userId: myId,
        userName: myName,
        hours: numHours,
        description: manualLogDesc.trim() || 'Work session completed',
        isBillable: manualLogBillable
      });

      if (res.success && res.data) {
        setSelectedTask(res.data);
        setTasks((prev) => prev.map((t) => (String(t._id) === String(selectedTask._id) ? res.data : t)));
        setManualLogHours('');
        setManualLogDesc('');
        setShowLogWorkModal(false);
      }
    } catch (err) {
      alert('Failed to log work: ' + err.message);
    } finally {
      setLoggingTime(false);
    }
  };

  // TaskOPad Calendar Grid Calculations
  const calendarGridDays = React.useMemo(() => {
    const year = calendarMonth.getFullYear();
    const month = calendarMonth.getMonth();

    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);

    const days = [];
    const startDayOfWeek = firstDay.getDay();
    for (let i = startDayOfWeek - 1; i >= 0; i--) {
      const d = new Date(year, month, -i);
      days.push({ date: d, isCurrentMonth: false });
    }

    for (let d = 1; d <= lastDay.getDate(); d++) {
      days.push({ date: new Date(year, month, d), isCurrentMonth: true });
    }

    const remaining = (7 - (days.length % 7)) % 7;
    for (let i = 1; i <= remaining; i++) {
      days.push({ date: new Date(year, month + 1, i), isCurrentMonth: false });
    }

    return days;
  }, [calendarMonth]);

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

  const viewsList = [
    { id: 'kanban', label: 'Kanban Board', shortLabel: 'Kanban', icon: LayoutGrid },
    { id: 'list', label: 'List View', shortLabel: 'List', icon: List },
    { id: 'calendar', label: 'Calendar View', shortLabel: 'Calendar', icon: Calendar },
    ...(isAdmin ? [
      { id: 'timeline', label: 'Timeline / Gantt', shortLabel: 'Timeline', icon: CalendarRange },
      { id: 'leaderboard', label: 'Leaderboard', shortLabel: 'Leaderboard', icon: Trophy },
      { id: 'timesheets', label: 'Timesheets', shortLabel: 'Timesheets', icon: Clock },
    ] : [])
  ];

  const scopeTabs = [
    { id: 'all', label: 'All Tasks', shortLabel: 'All Tasks', icon: '🎯', count: allCount, color: '#2563eb' },
    { id: 'my_tasks', label: 'My Tasks', shortLabel: 'My Tasks', icon: '👤', count: myTasksCount, color: '#0284c7' },
    { id: 'delegated', label: 'Assigned by Me (Delegated)', shortLabel: 'Delegated', icon: '🤝', count: delegatedCount, color: '#7c3aed' },
    { id: 'today', label: 'Due Today', shortLabel: 'Due Today', icon: '⏰', count: todayCount, color: '#d97706' },
    { id: 'overdue', label: 'Overdue', shortLabel: 'Overdue', icon: '🚨', count: overdueCount, color: '#dc2626', isAlert: overdueCount > 0 },
    { id: 'completed', label: 'Completed', shortLabel: 'Completed', icon: '✅', count: completedCount, color: '#16a34a' }
  ];

  const currentViewObj = viewsList.find(v => v.id === activeView) || viewsList[0];
  const currentScopeObj = scopeTabs.find(s => s.id === taskScope) || scopeTabs[0];
  const CurrentViewIcon = currentViewObj.icon;

  useEffect(() => {
    if (!isAdmin && ['timeline', 'leaderboard', 'timesheets'].includes(activeView)) {
      setActiveView('kanban');
    }
  }, [isAdmin, activeView]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', gap: '0.75rem', background: 'var(--bg-main)', boxSizing: 'border-box' }}>
      
      {/* ── RESPONSIVE EMBEDDED CSS ── */}
      <style>{`
        @media (max-width: 768px) {
          .task-desktop-header { display: none !important; }
          .task-desktop-scopes { display: none !important; }
          .task-desktop-filters { display: none !important; }
          .task-mobile-control-card { display: flex !important; flex-direction: column !important; }
          .kanban-grid-responsive {
            grid-template-columns: repeat(5, minmax(84vw, 1fr)) !important;
            scroll-snap-type: x mandatory;
            -webkit-overflow-scrolling: touch;
          }
          .kanban-col-snap {
            scroll-snap-align: start;
          }
        }
        @media (min-width: 769px) {
          .task-desktop-header { display: flex !important; }
          .task-desktop-scopes { display: flex !important; }
          .task-desktop-filters { display: flex !important; }
          .task-mobile-control-card { display: none !important; }
          .kanban-grid-responsive {
            grid-template-columns: repeat(5, minmax(260px, 1fr)) !important;
          }
        }
      `}</style>

      {/* ── DESKTOP: TOP HEADER CONTROL BAR ── */}
      <div className="glass-panel task-desktop-header" style={{ padding: '0.75rem 1.1rem', alignItems: 'center', justifyContent: 'space-between', borderRadius: '12px', background: '#ffffff', border: '1px solid var(--border-light)', boxShadow: '0 2px 10px rgba(37,99,235,0.05)', flexWrap: 'wrap', gap: '0.6rem' }}>
        
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
            {viewsList.map((v) => {
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

          {/* Export CSV Button */}
          <button
            onClick={handleExportCSV}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '5px',
              padding: '0.45rem 0.8rem',
              borderRadius: '8px',
              background: '#ffffff',
              border: '1px solid var(--border-light)',
              color: 'var(--text-primary)',
              fontSize: '0.78rem',
              fontWeight: 700,
              cursor: 'pointer',
              boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
              transition: 'all 0.15s ease'
            }}
            title="Export current tasks to CSV file"
          >
            <Download size={14} color="#2563eb" />
            <span>Export CSV</span>
          </button>

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

      {/* ── DESKTOP: TASKOPAD SCOPE NAVIGATION BAR ── */}
      <div className="glass-panel task-desktop-scopes" style={{ padding: '0.6rem 0.9rem', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap', borderRadius: '10px', background: '#ffffff', border: '1px solid var(--border-light)' }}>
        {scopeTabs.map((tab) => {
          const isActive = taskScope === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setTaskScope(tab.id)}
              style={{
                background: isActive ? '#2563eb' : '#f8fafc',
                color: isActive ? '#ffffff' : 'var(--text-primary)',
                border: isActive ? '1px solid #1d4ed8' : '1px solid var(--border-light)',
                padding: '0.35rem 0.75rem',
                borderRadius: '20px',
                fontSize: '0.74rem',
                fontWeight: 700,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                boxShadow: isActive ? '0 3px 8px rgba(37,99,235,0.25)' : 'none',
                transition: 'all 0.15s ease'
              }}
            >
              <span>{tab.icon} {tab.shortLabel}</span>
              <span
                style={{
                  background: isActive ? 'rgba(255,255,255,0.25)' : tab.isAlert ? '#fee2e2' : '#e2e8f0',
                  color: isActive ? '#ffffff' : tab.isAlert ? '#dc2626' : 'var(--text-muted)',
                  padding: '1px 6px',
                  borderRadius: '10px',
                  fontSize: '0.66rem',
                  fontWeight: 800
                }}
              >
                {tab.count}
              </span>
            </button>
          );
        })}
      </div>

      {/* ── DESKTOP: FILTERING & SEARCH BAR ── */}
      <div className="glass-panel task-desktop-filters" style={{ padding: '0.6rem 0.9rem', alignItems: 'center', justifyContent: 'space-between', borderRadius: '10px', background: '#ffffff', border: '1px solid var(--border-light)', gap: '0.6rem', flexWrap: 'wrap' }}>
        
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

      {/* ── MOBILE: COMPACT ACTION & DROPDOWN BAR ── */}
      <div className="glass-panel task-mobile-control-card" style={{ padding: '0.6rem 0.75rem', borderRadius: '12px', background: '#ffffff', border: '1px solid var(--border-light)', boxShadow: '0 2px 8px rgba(37,99,235,0.06)', gap: '0.5rem', position: 'relative', zIndex: (showMobileViewMenu || showMobileScopeMenu) ? 1000 : 1 }}>
        
        {/* Mobile Row 1: Header + Create Task */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.5rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <div style={{ width: 32, height: 32, borderRadius: '8px', background: 'linear-gradient(135deg, #38bdf8 0%, #2563eb 100%)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', boxShadow: '0 2px 8px rgba(37,99,235,0.25)', flexShrink: 0 }}>
              <CheckSquare size={17} />
            </div>
            <div>
              <div style={{ fontSize: '0.92rem', fontWeight: 800, color: 'var(--text-primary)', lineHeight: 1.2 }}>
                Workforce Tasks
              </div>
              <div style={{ fontSize: '0.64rem', color: 'var(--text-muted)', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '5px' }}>
                <span>{filteredTasks.length} tasks</span>
                {tasks.filter(t => t.activeTimer && t.activeTimer.startTime).length > 0 && (
                  <span style={{ color: '#16a34a', background: '#dcfce7', padding: '1px 5px', borderRadius: '3px', fontWeight: 800 }}>
                    ⏱️ {tasks.filter(t => t.activeTimer && t.activeTimer.startTime).length}
                  </span>
                )}
              </div>
            </div>
          </div>

          <button
            onClick={handleOpenCreateModal}
            className="btn-primary"
            style={{ fontSize: '0.74rem', padding: '0.4rem 0.75rem', gap: '0.3rem', borderRadius: '8px', background: 'linear-gradient(135deg, #38bdf8 0%, #2563eb 100%)', boxShadow: '0 3px 10px rgba(37,99,235,0.25)', whiteSpace: 'nowrap' }}
          >
            <Plus size={14} />
            <span>Create</span>
          </button>
        </div>

        {/* Mobile Row 2: View Switcher Button + Scope Selector Button + Filter Toggle + Export */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
          
          {/* 1. View Selector Dropdown Button */}
          <button
            onClick={() => {
              setShowMobileViewMenu(prev => !prev);
              setShowMobileScopeMenu(false);
            }}
            style={{
              flex: 1,
              minWidth: 0,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: '4px',
              padding: '0.42rem 0.6rem',
              borderRadius: '8px',
              background: showMobileViewMenu ? '#eff6ff' : '#f8fafc',
              border: showMobileViewMenu ? '1.5px solid #2563eb' : '1px solid var(--border-light)',
              cursor: 'pointer',
              color: showMobileViewMenu ? '#2563eb' : 'var(--text-primary)',
              fontSize: '0.74rem',
              fontWeight: 700
            }}
            title="Switch View"
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '5px', overflow: 'hidden', whiteSpace: 'nowrap' }}>
              <CurrentViewIcon size={13} color={showMobileViewMenu ? '#2563eb' : '#64748b'} style={{ flexShrink: 0 }} />
              <span style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>{currentViewObj.shortLabel}</span>
            </div>
            <ChevronDown size={13} color="#64748b" style={{ transform: showMobileViewMenu ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s', flexShrink: 0 }} />
          </button>

          {/* 2. Scope Selector Dropdown Button */}
          <button
            onClick={() => {
              setShowMobileScopeMenu(prev => !prev);
              setShowMobileViewMenu(false);
            }}
            style={{
              flex: 1.2,
              minWidth: 0,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: '4px',
              padding: '0.42rem 0.6rem',
              borderRadius: '8px',
              background: showMobileScopeMenu ? '#eff6ff' : (currentScopeObj.isAlert ? '#fef2f2' : '#f8fafc'),
              border: showMobileScopeMenu ? '1.5px solid #2563eb' : (currentScopeObj.isAlert ? '1px solid #fecaca' : '1px solid var(--border-light)'),
              cursor: 'pointer',
              color: currentScopeObj.isAlert ? '#dc2626' : (showMobileScopeMenu ? '#2563eb' : 'var(--text-primary)'),
              fontSize: '0.74rem',
              fontWeight: 700
            }}
            title="Filter by Scope"
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '4px', overflow: 'hidden', whiteSpace: 'nowrap' }}>
              <span style={{ fontSize: '0.78rem', flexShrink: 0 }}>{currentScopeObj.icon}</span>
              <span style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>{currentScopeObj.shortLabel}</span>
              <span style={{
                background: currentScopeObj.isAlert ? '#dc2626' : '#2563eb',
                color: '#ffffff',
                padding: '1px 5px',
                borderRadius: '8px',
                fontSize: '0.62rem',
                fontWeight: 800,
                flexShrink: 0
              }}>
                {currentScopeObj.count}
              </span>
            </div>
            <ChevronDown size={13} color="#64748b" style={{ transform: showMobileScopeMenu ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s', flexShrink: 0 }} />
          </button>

          {/* 3. Filter Toggle Button */}
          <button
            onClick={() => setShowMobileFilterMenu(prev => !prev)}
            style={{
              padding: '0.42rem 0.55rem',
              borderRadius: '8px',
              background: (showMobileFilterMenu || searchQuery || assigneeFilter !== 'all' || priorityFilter !== 'all') ? '#eff6ff' : '#f8fafc',
              border: (showMobileFilterMenu || searchQuery || assigneeFilter !== 'all' || priorityFilter !== 'all') ? '1.5px solid #2563eb' : '1px solid var(--border-light)',
              cursor: 'pointer',
              color: (showMobileFilterMenu || searchQuery || assigneeFilter !== 'all' || priorityFilter !== 'all') ? '#2563eb' : '#64748b',
              display: 'flex',
              alignItems: 'center',
              gap: '3px',
              position: 'relative'
            }}
            title="Search & Filters"
          >
            <Filter size={13} />
            {(searchQuery || assigneeFilter !== 'all' || priorityFilter !== 'all') && (
              <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#2563eb' }} />
            )}
          </button>

          {/* 4. Export CSV Button */}
          <button
            onClick={handleExportCSV}
            style={{
              padding: '0.42rem 0.55rem',
              borderRadius: '8px',
              background: '#f8fafc',
              border: '1px solid var(--border-light)',
              cursor: 'pointer',
              color: '#2563eb',
              display: 'flex',
              alignItems: 'center'
            }}
            title="Export CSV"
          >
            <Download size={13} />
          </button>
        </div>

        {/* ── MOBILE VIEW DROPDOWN MENU ── */}
        {showMobileViewMenu && (
          <>
            <div
              onClick={(e) => {
                e.stopPropagation();
                setShowMobileViewMenu(false);
              }}
              style={{
                position: 'fixed',
                inset: 0,
                zIndex: 1001,
                background: 'rgba(15, 23, 42, 0.25)',
                backdropFilter: 'blur(1px)'
              }}
            />
            <div
              style={{
                position: 'absolute',
                top: '100%',
                left: '0.75rem',
                right: '0.75rem',
                marginTop: '4px',
                background: '#ffffff',
                borderRadius: '12px',
                border: '1px solid var(--border-light)',
                boxShadow: '0 12px 30px rgba(15,23,42,0.22)',
                zIndex: 1002,
                padding: '8px',
                display: 'flex',
                flexDirection: 'column',
                gap: '4px'
              }}
            >
              <div style={{ fontSize: '0.68rem', fontWeight: 800, color: 'var(--text-muted)', textTransform: 'uppercase', padding: '4px 8px' }}>
                Select View
              </div>
              {viewsList.map((v) => {
                const IconComp = v.icon;
                const isSelected = activeView === v.id;
                return (
                  <button
                    key={v.id}
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      setActiveView(v.id);
                      setShowMobileViewMenu(false);
                    }}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      padding: '10px 12px',
                      borderRadius: '8px',
                      background: isSelected ? '#eff6ff' : 'transparent',
                      border: 'none',
                      color: isSelected ? '#2563eb' : 'var(--text-primary)',
                      fontWeight: isSelected ? 800 : 600,
                      fontSize: '0.84rem',
                      cursor: 'pointer',
                      textAlign: 'left',
                      minHeight: '42px',
                      touchAction: 'manipulation'
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                      <IconComp size={16} color={isSelected ? '#2563eb' : '#64748b'} />
                      <span>{v.label}</span>
                    </div>
                    {isSelected && <span style={{ color: '#2563eb', fontWeight: 800 }}>✓</span>}
                  </button>
                );
              })}
            </div>
          </>
        )}

        {/* ── MOBILE SCOPE DROPDOWN MENU ── */}
        {showMobileScopeMenu && (
          <>
            <div
              onClick={(e) => {
                e.stopPropagation();
                setShowMobileScopeMenu(false);
              }}
              style={{
                position: 'fixed',
                inset: 0,
                zIndex: 1001,
                background: 'rgba(15, 23, 42, 0.25)',
                backdropFilter: 'blur(1px)'
              }}
            />
            <div
              style={{
                position: 'absolute',
                top: '100%',
                left: '0.75rem',
                right: '0.75rem',
                marginTop: '4px',
                background: '#ffffff',
                borderRadius: '12px',
                border: '1px solid var(--border-light)',
                boxShadow: '0 12px 30px rgba(15,23,42,0.22)',
                zIndex: 1002,
                padding: '8px',
                display: 'flex',
                flexDirection: 'column',
                gap: '4px'
              }}
            >
              <div style={{ fontSize: '0.68rem', fontWeight: 800, color: 'var(--text-muted)', textTransform: 'uppercase', padding: '4px 8px' }}>
                Filter by Task Scope
              </div>
              {scopeTabs.map((tab) => {
                const isSelected = taskScope === tab.id;
                return (
                  <button
                    key={tab.id}
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      setTaskScope(tab.id);
                      setShowMobileScopeMenu(false);
                    }}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      padding: '10px 12px',
                      borderRadius: '8px',
                      background: isSelected ? '#eff6ff' : 'transparent',
                      border: 'none',
                      color: isSelected ? '#2563eb' : 'var(--text-primary)',
                      fontWeight: isSelected ? 800 : 600,
                      fontSize: '0.84rem',
                      cursor: 'pointer',
                      textAlign: 'left',
                      minHeight: '42px',
                      touchAction: 'manipulation'
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                      <span style={{ fontSize: '1rem' }}>{tab.icon}</span>
                      <span>{tab.label}</span>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <span
                        style={{
                          background: isSelected ? '#2563eb' : (tab.isAlert ? '#fee2e2' : '#e2e8f0'),
                          color: isSelected ? '#ffffff' : (tab.isAlert ? '#dc2626' : 'var(--text-muted)'),
                          padding: '2px 8px',
                          borderRadius: '10px',
                          fontSize: '0.72rem',
                          fontWeight: 800
                        }}
                      >
                        {tab.count}
                      </span>
                      {isSelected && <span style={{ color: '#2563eb', fontWeight: 800 }}>✓</span>}
                    </div>
                  </button>
                );
              })}
            </div>
          </>
        )}

        {/* ── MOBILE COLLAPSIBLE FILTER PANEL ── */}
        {showMobileFilterMenu && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.45rem', paddingTop: '0.35rem', borderTop: '1px solid var(--border-light)' }}>
            <div style={{ position: 'relative', width: '100%' }}>
              <Search size={13} style={{ position: 'absolute', left: '9px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
              <input
                type="text"
                placeholder="Search tasks by title, JC, client..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                style={{ width: '100%', paddingLeft: '28px', paddingRight: '24px', fontSize: '0.75rem', height: '30px', background: 'var(--bg-input)', border: '1px solid var(--border-light)', borderRadius: '6px', boxSizing: 'border-box' }}
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery('')}
                  style={{ position: 'absolute', right: '6px', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', color: '#94a3b8', cursor: 'pointer', fontSize: '0.8rem', padding: 0 }}
                >
                  ✕
                </button>
              )}
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.4rem' }}>
              <select
                value={assigneeFilter}
                onChange={(e) => setAssigneeFilter(e.target.value)}
                style={{ fontSize: '0.72rem', height: '30px', padding: '0 0.4rem', borderRadius: '6px', border: '1px solid var(--border-light)', background: '#ffffff', color: 'var(--text-primary)', fontWeight: 600, width: '100%' }}
              >
                <option value="all">All Staff</option>
                {allUsers.map((u) => (
                  <option key={u._id} value={u._id}>{u.name || u.username}</option>
                ))}
              </select>

              <select
                value={priorityFilter}
                onChange={(e) => setPriorityFilter(e.target.value)}
                style={{ fontSize: '0.72rem', height: '30px', padding: '0 0.4rem', borderRadius: '6px', border: '1px solid var(--border-light)', background: '#ffffff', color: 'var(--text-primary)', fontWeight: 600, width: '100%' }}
              >
                <option value="all">All Priorities</option>
                <option value="urgent">Urgent</option>
                <option value="high">High</option>
                <option value="medium">Medium</option>
                <option value="low">Low</option>
              </select>
            </div>

            {(searchQuery || assigneeFilter !== 'all' || priorityFilter !== 'all') && (
              <button
                onClick={() => {
                  setSearchQuery('');
                  setAssigneeFilter('all');
                  setPriorityFilter('all');
                }}
                style={{
                  background: 'none',
                  border: 'none',
                  color: '#2563eb',
                  fontSize: '0.68rem',
                  fontWeight: 700,
                  cursor: 'pointer',
                  textAlign: 'right',
                  padding: '2px 0'
                }}
              >
                Reset All Filters
              </button>
            )}
          </div>
        )}

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
          <div className="kanban-grid-responsive" style={{ display: 'grid', gridTemplateColumns: 'repeat(5, minmax(260px, 1fr))', gap: '0.75rem', height: '100%', overflowX: 'auto', paddingBottom: '0.5rem' }}>
            {KANBAN_COLUMNS.map((col) => {
              const colTasks = filteredTasks.filter((t) => t.status === col.id);

              return (
                <div
                  key={col.id}
                  className="kanban-col-snap"
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
                                {t.attachments && t.attachments.length > 0 && (
                                  <span style={{ fontSize: '0.6rem', fontWeight: 800, color: '#0284c7', background: '#f0f9ff', border: '1px solid #bae6fd', padding: '1px 5px', borderRadius: '4px', display: 'inline-flex', alignItems: 'center', gap: '2px' }} title={`${t.attachments.length} attachment(s)`}>
                                    <Paperclip size={10} />
                                    <span>{t.attachments.length}</span>
                                  </span>
                                )}
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
                  <th style={{ padding: '0.65rem 0.85rem' }}>Due Date</th>
                  <th style={{ padding: '0.65rem 0.85rem' }}>Subtasks</th>
                  <th style={{ padding: '0.65rem 0.85rem' }}>Assigned To</th>
                  <th style={{ padding: '0.65rem 0.85rem' }}>Assigned By</th>
                  <th style={{ padding: '0.65rem 0.85rem' }}>Project Ref</th>
                  <th style={{ padding: '0.65rem 0.85rem' }}>Hours Logged</th>
                  <th style={{ padding: '0.65rem 0.85rem', textAlign: 'right' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredTasks.length === 0 ? (
                  <tr>
                    <td colSpan={10} style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-muted)' }}>
                      No tasks found matching criteria.
                    </td>
                  </tr>
                ) : (
                  filteredTasks.map((t) => {
                    const pri = getPriorityBadge(t.priority);
                    const assignerName = getAssignerName(t);
                    const isOverdue = t.dueDate && new Date(t.dueDate) < new Date() && t.status !== 'Done';
                    const checkTotal = (t.checklist || []).length;
                    const checkDone = (t.checklist || []).filter(c => c.completed).length;
                    const checkPct = checkTotal > 0 ? Math.round((checkDone / checkTotal) * 100) : 0;

                    return (
                      <tr
                        key={t._id}
                        onClick={() => setSelectedTask(t)}
                        style={{ borderBottom: '1px solid var(--border-light)', cursor: 'pointer', transition: 'background 0.15s' }}
                      >
                        <td style={{ padding: '0.65rem 0.85rem', fontWeight: 700, color: 'var(--text-primary)' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                            <span>{t.title}</span>
                            {t.attachments && t.attachments.length > 0 && (
                              <span style={{ fontSize: '0.6rem', fontWeight: 800, color: '#0284c7', background: '#f0f9ff', border: '1px solid #bae6fd', padding: '1px 5px', borderRadius: '4px', display: 'inline-flex', alignItems: 'center', gap: '2px' }} title={`${t.attachments.length} attachment(s)`}>
                                <Paperclip size={10} />
                                <span>{t.attachments.length}</span>
                              </span>
                            )}
                            {t.recurrence && t.recurrence.isRecurring && (
                              <span style={{ fontSize: '0.6rem', fontWeight: 800, color: '#7c3aed', background: '#f3e8ff', padding: '1px 5px', borderRadius: '4px' }}>
                                🔄 {t.recurrence.frequency}
                              </span>
                            )}
                          </div>
                        </td>
                        <td style={{ padding: '0.65rem 0.85rem' }}>
                          <select
                            value={t.status}
                            onClick={(e) => e.stopPropagation()}
                            onChange={(e) => handleStatusChange(t, e.target.value)}
                            style={{ fontSize: '0.68rem', fontWeight: 800, padding: '2px 6px', borderRadius: '6px', border: '1px solid var(--border-light)', background: '#ffffff', color: '#2563eb', cursor: 'pointer' }}
                          >
                            {KANBAN_COLUMNS.map((c) => (
                              <option key={c.id} value={c.id}>{c.label}</option>
                            ))}
                          </select>
                        </td>
                        <td style={{ padding: '0.65rem 0.85rem' }}>
                          <span style={{ fontSize: '0.65rem', fontWeight: 800, color: pri.color, background: pri.bg, padding: '2px 7px', borderRadius: '4px' }}>
                            {pri.label}
                          </span>
                        </td>
                        <td style={{ padding: '0.65rem 0.85rem', whiteSpace: 'nowrap' }}>
                          {t.dueDate ? (
                            <div style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '0.72rem', fontWeight: 700, color: isOverdue ? '#dc2626' : 'var(--text-primary)' }}>
                              <Calendar size={12} />
                              <span>{new Date(t.dueDate).toLocaleDateString()}</span>
                              {isOverdue && (
                                <span style={{ fontSize: '0.6rem', color: '#dc2626', background: '#fee2e2', padding: '1px 4px', borderRadius: '4px', fontWeight: 800 }}>
                                  OVERDUE
                                </span>
                              )}
                            </div>
                          ) : (
                            <span style={{ color: 'var(--text-muted)', fontSize: '0.72rem' }}>No due date</span>
                          )}
                        </td>
                        <td style={{ padding: '0.65rem 0.85rem', minWidth: 110 }}>
                          {checkTotal > 0 ? (
                            <div>
                              <div style={{ fontSize: '0.68rem', fontWeight: 700, color: 'var(--text-muted)', marginBottom: '2px' }}>
                                {checkDone}/{checkTotal} ({checkPct}%)
                              </div>
                              <div style={{ width: '100%', height: '4px', background: '#e2e8f0', borderRadius: '4px', overflow: 'hidden' }}>
                                <div style={{ width: `${checkPct}%`, height: '100%', background: checkPct === 100 ? '#16a34a' : '#2563eb' }} />
                              </div>
                            </div>
                          ) : (
                            <span style={{ color: '#94a3b8', fontSize: '0.72rem' }}>-</span>
                          )}
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
                        <td style={{ padding: '0.65rem 0.85rem', fontWeight: 700, color: '#475569' }}>
                          {assignerName}
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

        ) : activeView === 'calendar' ? (

          /* ════ VIEW 2.5: TASKOPAD INTERACTIVE CALENDAR VIEW ════ */
          <div className="glass-panel" style={{ height: '100%', display: 'flex', flexDirection: 'column', background: '#ffffff', borderRadius: '12px', border: '1px solid var(--border-light)', overflow: 'hidden', padding: '1rem', boxSizing: 'border-box' }}>
            
            {/* Calendar Controls Bar */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.8rem', flexWrap: 'wrap', gap: '0.5rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.8rem' }}>
                <h3 style={{ margin: 0, fontSize: '1.05rem', fontWeight: 800, color: 'var(--text-primary)' }}>
                  {calendarMonth.toLocaleString('default', { month: 'long', year: 'numeric' })}
                </h3>
                <div style={{ display: 'flex', alignItems: 'center', gap: '3px', background: '#f8fafc', border: '1px solid var(--border-light)', borderRadius: '8px', padding: '2px' }}>
                  <button
                    type="button"
                    onClick={() => setCalendarMonth(new Date(calendarMonth.getFullYear(), calendarMonth.getMonth() - 1, 1))}
                    style={{ border: 'none', background: 'transparent', cursor: 'pointer', padding: '4px 6px', borderRadius: '4px', color: 'var(--text-primary)', display: 'flex', alignItems: 'center' }}
                    title="Previous Month"
                  >
                    <ChevronLeft size={16} />
                  </button>
                  <button
                    type="button"
                    onClick={() => setCalendarMonth(new Date())}
                    style={{ border: 'none', background: 'transparent', cursor: 'pointer', padding: '4px 8px', borderRadius: '4px', fontSize: '0.72rem', fontWeight: 800, color: '#2563eb' }}
                  >
                    Today
                  </button>
                  <button
                    type="button"
                    onClick={() => setCalendarMonth(new Date(calendarMonth.getFullYear(), calendarMonth.getMonth() + 1, 1))}
                    style={{ border: 'none', background: 'transparent', cursor: 'pointer', padding: '4px 6px', borderRadius: '4px', color: 'var(--text-primary)', display: 'flex', alignItems: 'center' }}
                    title="Next Month"
                  >
                    <ChevronRight size={16} />
                  </button>
                </div>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.7rem', fontWeight: 700, color: 'var(--text-muted)' }}>
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: '3px' }}><span style={{ width: 8, height: 8, borderRadius: '50%', background: '#dc2626' }} /> Urgent</span>
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: '3px' }}><span style={{ width: 8, height: 8, borderRadius: '50%', background: '#d97706' }} /> High</span>
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: '3px' }}><span style={{ width: 8, height: 8, borderRadius: '50%', background: '#2563eb' }} /> Medium</span>
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: '3px' }}><span style={{ width: 8, height: 8, borderRadius: '50%', background: '#16a34a' }} /> Done</span>
                </div>
              </div>
            </div>

            {/* Days of Week Header */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', background: '#f8fafc', border: '1px solid var(--border-light)', borderRadius: '8px 8px 0 0', textAlign: 'center', padding: '0.45rem 0', fontWeight: 800, fontSize: '0.72rem', color: 'var(--text-muted)' }}>
              {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((d) => (
                <div key={d}>{d}</div>
              ))}
            </div>

            {/* Calendar Cells Grid */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gridAutoRows: 'minmax(110px, 1fr)', flex: 1, minHeight: 0, overflowY: 'auto', border: '1px solid var(--border-light)', borderTop: 'none', borderRadius: '0 0 8px 8px' }}>
              {calendarGridDays.map((cell, idx) => {
                const isToday = cell.date.toDateString() === new Date().toDateString();
                const dayTasks = filteredTasks.filter((t) => t.dueDate && new Date(t.dueDate).toDateString() === cell.date.toDateString());

                return (
                  <div
                    key={idx}
                    style={{
                      borderRight: (idx + 1) % 7 === 0 ? 'none' : '1px solid var(--border-light)',
                      borderBottom: '1px solid var(--border-light)',
                      padding: '4px 6px',
                      background: isToday ? '#eff6ff' : cell.isCurrentMonth ? '#ffffff' : '#f8fafc',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '3px',
                      overflow: 'hidden'
                    }}
                  >
                    {/* Date Number Badge */}
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '2px' }}>
                      <span
                        style={{
                          fontSize: '0.72rem',
                          fontWeight: isToday ? 900 : 700,
                          width: 22,
                          height: 22,
                          borderRadius: '50%',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          background: isToday ? '#2563eb' : 'transparent',
                          color: isToday ? '#ffffff' : cell.isCurrentMonth ? 'var(--text-primary)' : '#94a3b8'
                        }}
                      >
                        {cell.date.getDate()}
                      </span>
                      {cell.isCurrentMonth && (
                        <button
                          type="button"
                          onClick={() => {
                            const y = cell.date.getFullYear();
                            const m = String(cell.date.getMonth() + 1).padStart(2, '0');
                            const d = String(cell.date.getDate()).padStart(2, '0');
                            setNewDueDate(`${y}-${m}-${d}`);
                            setShowCreateModal(true);
                          }}
                          style={{
                            border: 'none',
                            background: 'transparent',
                            color: '#2563eb',
                            fontSize: '0.65rem',
                            fontWeight: 800,
                            cursor: 'pointer',
                            padding: '0 4px',
                            opacity: 0.6
                          }}
                          title="Add task on this date"
                        >
                          + Add
                        </button>
                      )}
                    </div>

                    {/* Task Chips for Day */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '3px', overflowY: 'auto', flex: 1 }}>
                      {dayTasks.map((t) => {
                        const pri = getPriorityBadge(t.priority);
                        const isDone = t.status === 'Done';
                        return (
                          <div
                            key={t._id}
                            onClick={() => setSelectedTask(t)}
                            style={{
                              background: isDone ? '#f0fdf4' : pri.bg,
                              borderLeft: `3px solid ${isDone ? '#16a34a' : pri.color}`,
                              borderRadius: '4px',
                              padding: '2px 5px',
                              cursor: 'pointer',
                              display: 'flex',
                              flexDirection: 'column',
                              gap: '1px',
                              boxShadow: '0 1px 2px rgba(0,0,0,0.04)',
                              transition: 'transform 0.1s ease'
                            }}
                            title={`${t.title} - Status: ${t.status}`}
                          >
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '4px' }}>
                              <span style={{ fontSize: '0.68rem', fontWeight: 700, color: isDone ? '#16a34a' : 'var(--text-primary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                {isDone ? '✓ ' : ''}{t.title}
                              </span>
                            </div>
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: '0.6rem', color: 'var(--text-muted)' }}>
                              <span>{t.status}</span>
                              {(t.assignees || []).length > 0 && (
                                <span style={{ fontWeight: 700, color: '#2563eb' }}>
                                  {typeof t.assignees[0] === 'object' ? (t.assignees[0].name || t.assignees[0].username || '').split(' ')[0] : 'Staff'}
                                </span>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
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

              {/* Assigned By, Priority & Due Date */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '0.75rem' }}>
                <div>
                  <label style={{ fontSize: '0.78rem', fontWeight: 700, color: 'var(--text-primary)', display: 'block', marginBottom: '4px' }}>
                    Assigned By (Creator)
                  </label>
                  <div style={{ padding: '0.55rem', fontSize: '0.8rem', fontWeight: 700, borderRadius: '6px', background: '#f1f5f9', border: '1px solid var(--border-light)', color: '#2563eb', display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <User size={14} />
                    <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{myName}</span>
                  </div>
                </div>

                <div>
                  <label style={{ fontSize: '0.78rem', fontWeight: 700, color: 'var(--text-primary)', display: 'block', marginBottom: '4px' }}>
                    Priority
                  </label>
                  <select
                    value={newPriority}
                    onChange={(e) => setNewPriority(e.target.value)}
                    style={{ width: '100%', padding: '0.55rem', fontSize: '0.8rem', borderRadius: '6px', border: '1px solid var(--border-light)', background: '#ffffff', color: '#0f172a' }}
                  >
                    <option value="low">Low</option>
                    <option value="medium">Medium</option>
                    <option value="high">High</option>
                    <option value="urgent">Urgent</option>
                  </select>
                </div>

                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                    <label style={{ fontSize: '0.78rem', fontWeight: 700, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '4px' }}>
                      <Calendar size={13} color="#2563eb" />
                      <span>Due Date</span>
                    </label>
                    {newDueDate && (
                      <button
                        type="button"
                        onClick={() => setNewDueDate('')}
                        style={{ background: 'none', border: 'none', color: '#ef4444', fontSize: '0.68rem', fontWeight: 700, cursor: 'pointer', padding: 0 }}
                      >
                        Clear
                      </button>
                    )}
                  </div>
                  <input
                    type="date"
                    value={newDueDate}
                    onChange={(e) => setNewDueDate(e.target.value)}
                    style={{
                      width: '100%',
                      padding: '0.5rem 0.55rem',
                      fontSize: '0.8rem',
                      borderRadius: '6px',
                      border: newDueDate ? '1.5px solid #2563eb' : '1px solid var(--border-light)',
                      background: newDueDate ? '#eff6ff' : '#ffffff',
                      color: '#0f172a',
                      boxSizing: 'border-box'
                    }}
                  />
                  <div style={{ display: 'flex', gap: '4px', marginTop: '4px' }}>
                    <button
                      type="button"
                      onClick={() => {
                        const today = new Date().toISOString().split('T')[0];
                        setNewDueDate(today);
                      }}
                      style={{
                        flex: 1,
                        fontSize: '0.66rem',
                        padding: '2px 4px',
                        borderRadius: '4px',
                        border: '1px solid #e2e8f0',
                        background: '#f8fafc',
                        color: '#2563eb',
                        cursor: 'pointer',
                        fontWeight: 600,
                        textAlign: 'center'
                      }}
                    >
                      Today
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        const d = new Date();
                        d.setDate(d.getDate() + 1);
                        setNewDueDate(d.toISOString().split('T')[0]);
                      }}
                      style={{
                        flex: 1,
                        fontSize: '0.66rem',
                        padding: '2px 4px',
                        borderRadius: '4px',
                        border: '1px solid #e2e8f0',
                        background: '#f8fafc',
                        color: '#2563eb',
                        cursor: 'pointer',
                        fontWeight: 600,
                        textAlign: 'center'
                      }}
                    >
                      Tmrw
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        const d = new Date();
                        d.setDate(d.getDate() + 7);
                        setNewDueDate(d.toISOString().split('T')[0]);
                      }}
                      style={{
                        flex: 1,
                        fontSize: '0.66rem',
                        padding: '2px 4px',
                        borderRadius: '4px',
                        border: '1px solid #e2e8f0',
                        background: '#f8fafc',
                        color: '#2563eb',
                        cursor: 'pointer',
                        fontWeight: 600,
                        textAlign: 'center'
                      }}
                    >
                      +1 Wk
                    </button>
                  </div>
                </div>
              </div>

              {/* Assigned To Staff Selection Checkboxes */}
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px', flexWrap: 'wrap', gap: '0.4rem' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <label style={{ fontSize: '0.78rem', fontWeight: 700, color: 'var(--text-primary)' }}>
                      Assigned To Staff Members
                    </label>
                    <span
                      style={{
                        fontSize: '0.7rem',
                        fontWeight: 700,
                        padding: '1px 7px',
                        borderRadius: '10px',
                        background: selectedAssigneeIds.length > 0 ? '#eff6ff' : '#f0fdf4',
                        color: selectedAssigneeIds.length > 0 ? '#2563eb' : '#16a34a',
                        border: `1px solid ${selectedAssigneeIds.length > 0 ? '#bfdbfe' : '#bbf7d0'}`
                      }}
                    >
                      {selectedAssigneeIds.length > 0 ? `${selectedAssigneeIds.length} selected` : `Auto-assigned to self (${myName})`}
                    </span>
                  </div>
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
                {selectedAssigneeIds.length === 0 && (
                  <p style={{ margin: '2px 0 6px', fontSize: '0.72rem', color: '#16a34a', fontWeight: 600 }}>
                    💡 No staff selected — this task will automatically be assigned to you ({myName}).
                  </p>
                )}

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

              <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '0.75rem' }}>
                <div>
                  <label style={{ fontSize: '0.78rem', fontWeight: 700, color: 'var(--text-primary)', display: 'block', marginBottom: '4px' }}>
                    Project / Job Card Ref (Optional)
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. @JC-1004"
                    value={newProjectRef}
                    onChange={(e) => setNewProjectRef(e.target.value)}
                    style={{ width: '100%', padding: '0.5rem', fontSize: '0.8rem', borderRadius: '6px', border: '1px solid var(--border-light)', background: '#ffffff', boxSizing: 'border-box' }}
                  />
                </div>
                <div>
                  <label style={{ fontSize: '0.78rem', fontWeight: 700, color: 'var(--text-primary)', display: 'block', marginBottom: '4px' }}>
                    Est. Hours (Optional)
                  </label>
                  <input
                    type="number"
                    step="0.5"
                    min="0"
                    placeholder="e.g. 2.0"
                    value={newEstHours}
                    onChange={(e) => setNewEstHours(e.target.value)}
                    style={{ width: '100%', padding: '0.5rem', fontSize: '0.8rem', borderRadius: '6px', border: '1px solid var(--border-light)', background: '#ffffff', boxSizing: 'border-box' }}
                  />
                </div>
              </div>

              {/* Attachments Section (Cloudflare R2) */}
              <div style={{ background: '#f8fafc', padding: '0.75rem', borderRadius: '10px', border: '1px solid #e2e8f0' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '6px' }}>
                  <label style={{ fontSize: '0.78rem', fontWeight: 700, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '5px' }}>
                    <Paperclip size={14} color="#0284c7" />
                    <span>Attachments ({newAttachments.length})</span>
                    <span style={{ fontSize: '0.64rem', fontWeight: 700, color: '#0284c7', background: '#e0f2fe', padding: '1px 6px', borderRadius: '4px' }}>Cloudflare R2</span>
                  </label>
                  <button
                    type="button"
                    onClick={() => fileInputRef.current && fileInputRef.current.click()}
                    disabled={uploadingAttachment}
                    style={{
                      background: '#eff6ff',
                      border: '1px solid #bfdbfe',
                      color: '#2563eb',
                      padding: '3px 8px',
                      borderRadius: '6px',
                      fontSize: '0.72rem',
                      fontWeight: 700,
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '4px'
                    }}
                  >
                    <Plus size={12} />
                    <span>{uploadingAttachment ? 'Uploading to R2...' : '+ Attach Files'}</span>
                  </button>
                  <input
                    type="file"
                    ref={fileInputRef}
                    multiple
                    onChange={handleUploadNewTaskAttachments}
                    style={{ display: 'none' }}
                  />
                </div>

                {uploadingAttachment && (
                  <div style={{ fontSize: '0.72rem', color: '#0284c7', fontWeight: 600, padding: '4px 0', display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <span style={{ width: 12, height: 12, border: '2px solid #bae6fd', borderTopColor: '#0284c7', borderRadius: '50%', animation: 'spin 0.8s linear infinite', display: 'inline-block' }} />
                    <span>Uploading attachment to Cloudflare R2...</span>
                  </div>
                )}

                {newAttachments.length > 0 ? (
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginTop: '4px' }}>
                    {newAttachments.map((att, idx) => (
                      <div
                        key={idx}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: '6px',
                          background: '#ffffff',
                          border: '1px solid #cbd5e1',
                          borderRadius: '6px',
                          padding: '4px 8px',
                          fontSize: '0.72rem'
                        }}
                      >
                        {/\.(jpg|jpeg|png|webp|gif)$/i.test(att.fileName) ? (
                          <img src={att.fileUrl} alt={att.fileName} style={{ width: 22, height: 22, borderRadius: 4, objectFit: 'cover' }} />
                        ) : (
                          <FileText size={14} color="#64748b" />
                        )}
                        <span style={{ fontWeight: 600, color: 'var(--text-primary)', maxWidth: 140, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={att.fileName}>
                          {att.fileName}
                        </span>
                        <span style={{ color: 'var(--text-muted)', fontSize: '0.65rem' }}>({formatFileSize(att.fileSize)})</span>
                        <button
                          type="button"
                          onClick={() => handleRemoveNewAttachment(idx)}
                          style={{ background: 'none', border: 'none', color: '#ef4444', padding: 0, cursor: 'pointer', display: 'flex', alignItems: 'center' }}
                          title="Remove attachment"
                        >
                          <X size={13} />
                        </button>
                      </div>
                    ))}
                  </div>
                ) : (
                  !uploadingAttachment && (
                    <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', fontStyle: 'italic' }}>
                      Optional: Attach job card proofs, artwork files, or specs. Files will be stored in Cloudflare R2.
                    </div>
                  )
                )}
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

                {/* Checklist / Subtasks */}
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.4rem' }}>
                    <h4 style={{ margin: 0, fontSize: '0.85rem', fontWeight: 700, color: 'var(--text-primary)' }}>
                      Subtasks &amp; Checklist ({ (selectedTask.checklist || []).filter(c => c.completed).length } / { (selectedTask.checklist || []).length })
                    </h4>
                    {(selectedTask.checklist || []).length > 0 && (
                      <span style={{ fontSize: '0.72rem', fontWeight: 800, color: (selectedTask.checklist || []).filter(c => c.completed).length === (selectedTask.checklist || []).length ? '#16a34a' : '#2563eb' }}>
                        {Math.round(((selectedTask.checklist || []).filter(c => c.completed).length / (selectedTask.checklist || []).length) * 100)}% Completed
                      </span>
                    )}
                  </div>

                  {(selectedTask.checklist || []).length > 0 && (
                    <div style={{ width: '100%', height: '5px', background: '#e2e8f0', borderRadius: '4px', overflow: 'hidden', marginBottom: '0.6rem' }}>
                      <div
                        style={{
                          height: '100%',
                          width: `${((selectedTask.checklist || []).filter(c => c.completed).length / (selectedTask.checklist || []).length) * 100}%`,
                          background: (selectedTask.checklist || []).filter(c => c.completed).length === (selectedTask.checklist || []).length ? '#16a34a' : '#2563eb',
                          transition: 'width 0.3s ease'
                        }}
                      />
                    </div>
                  )}
                  
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

                {/* Attachments (Stored in Cloudflare R2) */}
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.4rem' }}>
                    <h4 style={{ margin: 0, fontSize: '0.85rem', fontWeight: 700, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '5px' }}>
                      <Paperclip size={15} color="#0284c7" />
                      <span>Attachments ({ (selectedTask.attachments || []).length })</span>
                      <span style={{ fontSize: '0.64rem', fontWeight: 700, color: '#0284c7', background: '#e0f2fe', padding: '1px 6px', borderRadius: '4px' }}>Cloudflare R2</span>
                    </h4>
                    <button
                      type="button"
                      onClick={() => drawerFileInputRef.current && drawerFileInputRef.current.click()}
                      disabled={drawerUploadingAttachment}
                      style={{
                        background: '#eff6ff',
                        border: '1px solid #bfdbfe',
                        color: '#2563eb',
                        padding: '3px 8px',
                        borderRadius: '6px',
                        fontSize: '0.72rem',
                        fontWeight: 700,
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '4px'
                      }}
                    >
                      <Plus size={12} />
                      <span>{drawerUploadingAttachment ? 'Uploading to R2...' : '+ Add File'}</span>
                    </button>
                    <input
                      type="file"
                      ref={drawerFileInputRef}
                      multiple
                      onChange={handleUploadDrawerAttachment}
                      style={{ display: 'none' }}
                    />
                  </div>

                  {drawerUploadingAttachment && (
                    <div style={{ fontSize: '0.72rem', color: '#0284c7', fontWeight: 600, padding: '4px 0', display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '6px' }}>
                      <span style={{ width: 12, height: 12, border: '2px solid #bae6fd', borderTopColor: '#0284c7', borderRadius: '50%', animation: 'spin 0.8s linear infinite', display: 'inline-block' }} />
                      <span>Uploading and storing attachment in Cloudflare R2...</span>
                    </div>
                  )}

                  {(selectedTask.attachments || []).length > 0 ? (
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '0.5rem', marginBottom: '0.6rem' }}>
                      {(selectedTask.attachments || []).map((att) => {
                        const isImg = /\.(jpg|jpeg|png|webp|gif)$/i.test(att.fileName) || (att.fileType && att.fileType.startsWith('image/'));
                        return (
                          <div
                            key={att._id || att.fileUrl}
                            style={{
                              background: '#f8fafc',
                              border: '1px solid var(--border-light)',
                              borderRadius: '8px',
                              padding: '0.55rem',
                              display: 'flex',
                              flexDirection: 'column',
                              justifyContent: 'space-between',
                              gap: '6px'
                            }}
                          >
                            <div style={{ display: 'flex', alignItems: 'flex-start', gap: '8px' }}>
                              {isImg ? (
                                <a href={att.fileUrl} target="_blank" rel="noopener noreferrer" style={{ display: 'block', flexShrink: 0 }}>
                                  <img
                                    src={att.fileUrl}
                                    alt={att.fileName}
                                    style={{ width: 42, height: 42, borderRadius: 6, objectFit: 'cover', border: '1px solid #e2e8f0' }}
                                  />
                                </a>
                              ) : (
                                <div style={{ width: 42, height: 42, borderRadius: 6, background: '#e0f2fe', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                                  <FileText size={20} color="#0284c7" />
                                </div>
                              )}
                              <div style={{ flex: 1, minWidth: 0 }}>
                                <a
                                  href={att.fileUrl}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  style={{
                                    fontSize: '0.75rem',
                                    fontWeight: 700,
                                    color: '#2563eb',
                                    textDecoration: 'none',
                                    display: 'block',
                                    overflow: 'hidden',
                                    textOverflow: 'ellipsis',
                                    whiteSpace: 'nowrap'
                                  }}
                                  title={att.fileName}
                                >
                                  {att.fileName}
                                </a>
                                <div style={{ fontSize: '0.65rem', color: 'var(--text-muted)', marginTop: '2px' }}>
                                  {formatFileSize(att.fileSize)}
                                </div>
                                {att.uploadedAt && (
                                  <div style={{ fontSize: '0.62rem', color: '#94a3b8' }}>
                                    {new Date(att.uploadedAt).toLocaleDateString()}
                                  </div>
                                )}
                              </div>
                            </div>

                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '6px', borderTop: '1px solid #e2e8f0', paddingTop: '4px' }}>
                              <a
                                href={att.fileUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                download={att.fileName}
                                style={{
                                  background: 'none',
                                  border: 'none',
                                  color: '#2563eb',
                                  fontSize: '0.68rem',
                                  fontWeight: 700,
                                  display: 'flex',
                                  alignItems: 'center',
                                  gap: '3px',
                                  textDecoration: 'none',
                                  cursor: 'pointer'
                                }}
                              >
                                <Download size={11} />
                                <span>Open / Download</span>
                              </a>
                              <button
                                type="button"
                                onClick={() => handleDeleteDrawerAttachment(att._id)}
                                style={{
                                  background: 'none',
                                  border: 'none',
                                  color: '#ef4444',
                                  fontSize: '0.68rem',
                                  fontWeight: 700,
                                  display: 'flex',
                                  alignItems: 'center',
                                  gap: '3px',
                                  cursor: 'pointer',
                                  padding: '2px 4px'
                                }}
                                title="Delete attachment"
                              >
                                <Trash2 size={11} />
                              </button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    !drawerUploadingAttachment && (
                      <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', background: '#f8fafc', padding: '0.6rem 0.8rem', borderRadius: '8px', border: '1px dashed var(--border-light)', textAlign: 'center', marginBottom: '0.6rem' }}>
                        No files attached to this task. Click <strong>+ Add File</strong> to upload to Cloudflare R2.
                      </div>
                    )
                  )}
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
              <div style={{ padding: '1.2rem', background: '#f8fafc', display: 'flex', flexDirection: 'column', gap: '1rem', overflowY: 'auto' }}>
                
                <div>
                  <label style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--text-muted)', display: 'block', marginBottom: '3px' }}>Status</label>
                  <select
                    value={selectedTask.status}
                    onChange={(e) => handleStatusChange(selectedTask, e.target.value)}
                    style={{ width: '100%', padding: '0.45rem', fontSize: '0.78rem', fontWeight: 700, borderRadius: '6px', border: '1px solid var(--border-light)', background: '#ffffff', color: '#2563eb' }}
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
                  <label style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--text-muted)', display: 'block', marginBottom: '3px' }}>Due Date</label>
                  <div style={{ fontSize: '0.78rem', fontWeight: 700, color: selectedTask.dueDate && new Date(selectedTask.dueDate) < new Date() && selectedTask.status !== 'Done' ? '#dc2626' : 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '4px' }}>
                    <Calendar size={13} />
                    <span>{selectedTask.dueDate ? new Date(selectedTask.dueDate).toLocaleDateString() : 'No deadline set'}</span>
                    {selectedTask.dueDate && new Date(selectedTask.dueDate) < new Date() && selectedTask.status !== 'Done' && (
                      <span style={{ fontSize: '0.6rem', color: '#dc2626', background: '#fee2e2', padding: '1px 5px', borderRadius: '4px', fontWeight: 800 }}>
                        OVERDUE
                      </span>
                    )}
                  </div>
                </div>

                {/* ── TaskOPad Work Logs & Time Tracking ── */}
                <div style={{ background: '#ffffff', borderRadius: '8px', border: '1px solid var(--border-light)', padding: '0.8rem', display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <div style={{ fontSize: '0.72rem', fontWeight: 800, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '4px' }}>
                      <Clock size={13} color="#2563eb" />
                      <span>Time Tracking</span>
                    </div>
                    <button
                      type="button"
                      onClick={() => setShowLogWorkModal((prev) => !prev)}
                      style={{ background: '#eff6ff', border: '1px solid #bfdbfe', color: '#2563eb', padding: '2px 6px', borderRadius: '4px', fontSize: '0.68rem', fontWeight: 800, cursor: 'pointer' }}
                    >
                      {showLogWorkModal ? '✕ Close' : '+ Log Work'}
                    </button>
                  </div>

                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.72rem', fontWeight: 700 }}>
                    <span style={{ color: '#2563eb' }}>⏱️ {calculateTotalLoggedHours(selectedTask.timeLogs)}h Logged</span>
                    <span style={{ color: 'var(--text-muted)' }}>Est: {selectedTask.estimatedHours || 0}h</span>
                  </div>

                  {/* Stopwatch Button */}
                  {(() => {
                    const isRunning = (selectedTask.liveTimers || []).some(
                      (lt) => String(typeof lt.user === 'object' ? (lt.user._id || lt.user.id) : lt.user) === String(myId) && lt.isRunning
                    );
                    const runningTimer = (selectedTask.liveTimers || []).find(
                      (lt) => String(typeof lt.user === 'object' ? (lt.user._id || lt.user.id) : lt.user) === String(myId) && lt.isRunning
                    );

                    return isRunning ? (
                      <button
                        type="button"
                        onClick={(e) => handleStopTimer(selectedTask._id, e)}
                        style={{ width: '100%', padding: '0.4rem', borderRadius: '6px', background: '#fee2e2', border: '1px solid #fca5a5', color: '#dc2626', fontSize: '0.72rem', fontWeight: 800, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '5px', cursor: 'pointer' }}
                      >
                        <Square size={12} fill="#dc2626" />
                        <span>Stop Timer ({formatElapsedTimer(runningTimer?.startTime)})</span>
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={(e) => handleStartTimer(selectedTask._id, e)}
                        style={{ width: '100%', padding: '0.4rem', borderRadius: '6px', background: '#eff6ff', border: '1px solid #bfdbfe', color: '#2563eb', fontSize: '0.72rem', fontWeight: 800, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '5px', cursor: 'pointer' }}
                      >
                        <Play size={12} fill="#2563eb" />
                        <span>Start Stopwatch</span>
                      </button>
                    );
                  })()}

                  {/* Manual Log Work Form */}
                  {showLogWorkModal && (
                    <form onSubmit={handleLogManualWork} style={{ background: '#f8fafc', border: '1px solid #bfdbfe', borderRadius: '6px', padding: '0.6rem', display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                      <div style={{ display: 'flex', gap: '0.4rem', alignItems: 'center' }}>
                        <div style={{ flex: 1 }}>
                          <label style={{ fontSize: '0.65rem', fontWeight: 700, color: 'var(--text-muted)', display: 'block' }}>Hours</label>
                          <input
                            type="number"
                            step="0.1"
                            min="0.1"
                            placeholder="e.g. 1.5"
                            value={manualLogHours}
                            onChange={(e) => setManualLogHours(e.target.value)}
                            style={{ width: '100%', padding: '3px 6px', fontSize: '0.72rem', borderRadius: '4px', border: '1px solid var(--border-light)', boxSizing: 'border-box' }}
                            required
                          />
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '3px', paddingTop: '12px' }}>
                          <input
                            type="checkbox"
                            id="drawerBillable"
                            checked={manualLogBillable}
                            onChange={(e) => setManualLogBillable(e.target.checked)}
                          />
                          <label htmlFor="drawerBillable" style={{ fontSize: '0.68rem', fontWeight: 700, color: 'var(--text-primary)', cursor: 'pointer' }}>Billable</label>
                        </div>
                      </div>

                      <div>
                        <label style={{ fontSize: '0.65rem', fontWeight: 700, color: 'var(--text-muted)', display: 'block' }}>Notes</label>
                        <input
                          type="text"
                          placeholder="What did you work on?"
                          value={manualLogDesc}
                          onChange={(e) => setManualLogDesc(e.target.value)}
                          style={{ width: '100%', padding: '3px 6px', fontSize: '0.72rem', borderRadius: '4px', border: '1px solid var(--border-light)', boxSizing: 'border-box' }}
                        />
                      </div>

                      <button
                        type="submit"
                        disabled={loggingTime}
                        className="btn-primary"
                        style={{ padding: '0.35rem', fontSize: '0.72rem', fontWeight: 800 }}
                      >
                        {loggingTime ? 'Saving...' : 'Save Work Log'}
                      </button>
                    </form>
                  )}

                  {/* Recent Logs List */}
                  {(selectedTask.timeLogs || []).length > 0 && (
                    <div style={{ maxHeight: '110px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '3px' }}>
                      {(selectedTask.timeLogs || []).map((l, idx) => (
                        <div key={idx} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '3px 6px', background: '#f8fafc', borderRadius: '4px', fontSize: '0.68rem' }}>
                          <span style={{ color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            <strong>{l.userName || 'Staff'}</strong>: {l.description || 'Logged work'}
                          </span>
                          <span style={{ fontWeight: 800, color: '#2563eb', whiteSpace: 'nowrap', marginLeft: '6px' }}>{l.hours}h</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                <div>
                  <label style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--text-muted)', display: 'block', marginBottom: '3px' }}>Assigned By</label>
                  <div style={{ fontSize: '0.8rem', fontWeight: 700, color: '#475569' }}>
                    {getAssignerName(selectedTask)}
                  </div>
                </div>

                <div>
                  <label style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--text-muted)', display: 'block', marginBottom: '3px' }}>Assigned To</label>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', maxHeight: '180px', overflowY: 'auto' }}>
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
