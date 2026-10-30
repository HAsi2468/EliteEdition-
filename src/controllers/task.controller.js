const mongoose = require('mongoose');
const { Task } = require('../db/models/task.model');
const { user: User } = require('../db/models');
const webPushService = require('../services/webPush.service');

let _lastOverdueCheckAt = 0;

const escapeRegex = (str) => String(str || '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const STATUS_MAP = {
  backlog: 'Backlog',
  todo: 'To Do',
  'to do': 'To Do',
  'in progress': 'In Progress',
  in_progress: 'In Progress',
  'in review': 'In Review',
  in_review: 'In Review',
  done: 'Done',
  completed: 'Done'
};

const normalizeTaskStatus = (s) => {
  if (!s) return 'To Do';
  const key = String(s).trim().toLowerCase();
  return STATUS_MAP[key] || s;
};

const normalizeTaskPriority = (p) => {
  if (!p) return 'medium';
  const key = String(p).trim().toLowerCase();
  return ['low', 'medium', 'high', 'urgent'].includes(key) ? key : 'medium';
};

const populateTaskById = (id) =>
  Task.findById(id)
    .populate('assignees', 'name email role department avatar')
    .populate('createdBy', 'name email role avatar')
    .populate('dependencies', 'title status priority assignees')
    .populate('attachments.uploadedBy', 'name email');

/**
 * Get all tasks with pagination, search, & multi-attribute filtering
 */
const getTasks = async (req, res) => {
  try {
    const {
      status,
      priority,
      department,
      assignee,
      createdBy,
      projectRef,
      lotNo,
      search,
      page = 1,
      limit = 1000,
      sortBy = 'createdAt',
      sortOrder = 'desc'
    } = req.query;

    const query = {};
    const andConditions = [];

    if (status && status !== 'all') {
      query.status = normalizeTaskStatus(status);
    }
    if (priority && priority !== 'all') {
      query.priority = normalizeTaskPriority(priority);
    }
    if (department && department !== 'all') {
      query.department = department;
    }
    if (projectRef) {
      query.projectRef = { $regex: escapeRegex(projectRef), $options: 'i' };
    }
    if (lotNo) {
      query.lotNo = { $regex: escapeRegex(lotNo), $options: 'i' };
    }
    if (assignee && assignee !== 'all') {
      if (mongoose.Types.ObjectId.isValid(assignee)) {
        query.assignees = new mongoose.Types.ObjectId(assignee);
      } else {
        const safeAssignee = escapeRegex(assignee);
        const matchedUsers = await User.find({
          $or: [
            { name: { $regex: safeAssignee, $options: 'i' } },
            { username: { $regex: safeAssignee, $options: 'i' } },
            { email: { $regex: safeAssignee, $options: 'i' } }
          ]
        }).select('_id').lean();
        query.assignees = { $in: matchedUsers.map(u => u._id) };
      }
    }
    if (createdBy && createdBy !== 'all') {
      if (mongoose.Types.ObjectId.isValid(createdBy)) {
        query.createdBy = new mongoose.Types.ObjectId(createdBy);
      } else {
        const safeCreatedBy = escapeRegex(createdBy);
        const matchedUsers = await User.find({
          $or: [
            { name: { $regex: safeCreatedBy, $options: 'i' } },
            { username: { $regex: safeCreatedBy, $options: 'i' } },
            { email: { $regex: safeCreatedBy, $options: 'i' } }
          ]
        }).select('_id').lean();
        query.createdBy = { $in: matchedUsers.map(u => u._id) };
      }
    }

    // Exclude test tasks from all live lists
    andConditions.push({
      title: { $not: /^TEST/i },
      name: { $not: /^TEST/i },
      isTest: { $ne: true }
    });

    if (search && search.trim()) {
      const term = escapeRegex(search.trim());
      const cleanTerm = escapeRegex(search.trim().replace(/^@/, '').trim());
      andConditions.push({
        $or: [
          { title: { $regex: term, $options: 'i' } },
          { description: { $regex: term, $options: 'i' } },
          { projectRef: { $regex: term, $options: 'i' } },
          { projectRef: { $regex: cleanTerm, $options: 'i' } },
          { clientName: { $regex: term, $options: 'i' } },
          { lotNo: { $regex: term, $options: 'i' } },
          { department: { $regex: term, $options: 'i' } }
        ]
      });
    }

    // Role-based Access Control:
    // Master admin can see all tasks.
    // Regular users can ONLY see tasks assigned to them or created/assigned by them.
    const userRole = (req.user?.role || req.headers['x-user-role'] || '').toLowerCase();
    const isMasterAdmin = userRole === 'admin' ||
      userRole === 'super_admin' ||
      Boolean(req.user?.isMainAdmin) ||
      Boolean(req.user?.isAdmin) ||
      req.headers['x-is-admin'] === 'true' ||
      (req.user?.username || req.headers['x-user-name'] || '').toLowerCase() === 'admin';

    const currentUserId = req.user?._id || req.headers['x-user-id'] || req.query.userId;

    if (!isMasterAdmin) {
      if (currentUserId && mongoose.Types.ObjectId.isValid(currentUserId)) {
        const userObjId = new mongoose.Types.ObjectId(currentUserId);
        andConditions.push({
          $or: [
            { assignees: userObjId },
            { createdBy: userObjId }
          ]
        });
      } else {
        andConditions.push({ _id: null });
      }
    }

    if (andConditions.length === 1) {
      Object.assign(query, andConditions[0]);
    } else if (andConditions.length > 1) {
      query.$and = andConditions;
    }

    const pageNum = Math.max(1, parseInt(page, 10) || 1);
    const limitNum = Math.max(1, Math.min(2000, parseInt(limit, 10) || 200));
    const skip = (pageNum - 1) * limitNum;
    const allowedSortFields = new Set(['createdAt', 'updatedAt', 'dueDate', 'priority', 'status', 'title']);
    const safeSortBy = allowedSortFields.has(sortBy) ? sortBy : 'createdAt';
    const sort = { [safeSortBy]: sortOrder === 'asc' ? 1 : -1 };

    const total = await Task.countDocuments(query);
    let tasks;
    try {
      tasks = await Task.find(query)
        .populate('assignees', 'name email role department avatar')
        .populate('createdBy', 'name email role avatar')
        .populate('dependencies', 'title status priority')
        .sort(sort)
        .skip(skip)
        .limit(limitNum);
    } catch (popErr) {
      console.warn('[TaskController] Populate fallback triggered:', popErr.message);
      tasks = await Task.find(query)
        .sort(sort)
        .skip(skip)
        .limit(limitNum)
        .lean();
    }

    // Trigger throttled async overdue tasks check (max once every 60s)
    const now = Date.now();
    if (now - _lastOverdueCheckAt > 60000) {
      _lastOverdueCheckAt = now;
      const io = req.app?.get ? (req.app.get('socketio') || req.app.get('io')) : (global.io || null);
      checkOverdueTasks(io).catch(e => console.error('Overdue check error:', e));
    }

    res.json({
      success: true,
      data: tasks,
      pagination: {
        total,
        page: pageNum,
        limit: limitNum,
        totalPages: Math.ceil(total / limitNum)
      }
    });
  } catch (error) {
    console.error('Error fetching tasks:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch tasks', error: error.message });
  }
};

/**
 * Get single task by ID
 */
const getTaskById = async (req, res) => {
  try {
    const { id } = req.params;
    const task = await Task.findById(id)
      .populate('assignees', 'name email role department')
      .populate('createdBy', 'name email role')
      .populate('dependencies', 'title status priority assignees')
      .populate('attachments.uploadedBy', 'name email');

    if (!task) {
      return res.status(404).json({ success: false, message: 'Task not found' });
    }

    // Check visibility permissions for non-master admin
    const userRole = (req.user?.role || '').toLowerCase();
    const isMasterAdmin = userRole === 'admin' ||
      Boolean(req.user?.isMainAdmin) ||
      (req.user?.username || '').toLowerCase() === 'admin' ||
      (req.user?.email || '').toLowerCase() === 'harshitsidapara2468@gmail.com';
    const currentUserId = String(req.user?._id || req.headers['x-user-id'] || req.query.userId || '');

    if (!isMasterAdmin && currentUserId) {
      const isAssigned = (task.assignees || []).some(a => String(a._id || a) === currentUserId);
      const isCreator = String(task.createdBy?._id || task.createdBy || '') === currentUserId;
      if (!isAssigned && !isCreator) {
        return res.status(403).json({ success: false, message: 'You do not have permission to view this task' });
      }
    }

    res.json({ success: true, data: task });
  } catch (error) {
    console.error('Error fetching task details:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch task details', error: error.message });
  }
};

/**
 * Create a new task
 */
const createTask = async (req, res) => {
  try {
    const {
      title,
      description = '',
      priority = 'medium',
      status = 'To Do',
      department = 'General',
      projectRef = '',
      clientName = '',
      lotNo = '',
      dueDate,
      estimatedHours = 0,
      assignees = [],
      dependencies = [],
      checklist = [],
      tags = [],
      attachments = [],
      images = [],
      recurrence = null,
      createdBy: customCreatedBy,
      createdByName = 'Admin'
    } = req.body;

    if (!title || !title.trim()) {
      return res.status(400).json({ success: false, message: 'Task title is required' });
    }

    if (title.trim().length > 200) {
      return res.status(400).json({ success: false, message: 'Task title cannot exceed 200 characters.' });
    }

    const numEstHours = Number(estimatedHours) || 0;
    if (numEstHours < 0 || numEstHours > 1000) {
      return res.status(400).json({ success: false, message: 'Estimated hours must be between 0 and 1,000.' });
    }

    // Robustly determine and validate creatorId
    if (!req.user || (!req.user._id && !req.user.id)) {
      return res.status(401).json({
        success: false,
        code: 'UNAUTHORIZED',
        message: 'Authentication required. Please provide a valid Bearer token.'
      });
    }

    const rawCreatorId = req.user._id || req.user.id || customCreatedBy;
    let creatorId = null;
    if (rawCreatorId && mongoose.Types.ObjectId.isValid(String(rawCreatorId))) {
      creatorId = new mongoose.Types.ObjectId(String(rawCreatorId));
    } else {
      try {
        const adminUser = await User.findOne({
          $or: [{ role: 'admin' }, { role: 'super_admin' }, { username: 'admin' }]
        }).select('_id');
        if (adminUser) creatorId = adminUser._id;
      } catch (uErr) {
        console.warn('[TaskController] Could not find fallback admin user:', uErr.message);
      }
    }
    const creatorName = req.user.name || req.user.username || 'Staff User';

    // Sanitize assignees: only keep valid ObjectIds
    let finalAssignees = Array.isArray(assignees)
      ? assignees
          .filter(a => a && mongoose.Types.ObjectId.isValid(String(typeof a === 'object' ? (a._id || a.id) : a)))
          .map(a => new mongoose.Types.ObjectId(String(typeof a === 'object' ? (a._id || a.id) : a)))
      : [];

    // If no staff members were selected, automatically assign to creator if valid
    if (finalAssignees.length === 0 && creatorId) {
      finalAssignees = [creatorId];
    }

    // Sanitize dependencies
    const validDependencies = Array.isArray(dependencies)
      ? dependencies
          .filter(d => d && mongoose.Types.ObjectId.isValid(String(typeof d === 'object' ? (d._id || d.id) : d)))
          .map(d => new mongoose.Types.ObjectId(String(typeof d === 'object' ? (d._id || d.id) : d)))
      : [];

    const initialAudit = [{
      user: creatorId || undefined,
      userName: creatorName,
      fieldChanged: 'Task Created',
      oldValue: '',
      newValue: `Created "${title.trim()}" in ${department}`,
      timestamp: new Date()
    }];

    const formattedAttachments = Array.isArray(attachments) ? attachments.map(att => ({
      fileName: att.fileName || att.name || 'Attachment',
      fileUrl: att.fileUrl || att.url,
      fileSize: Number(att.fileSize || att.size) || 0,
      fileType: att.fileType || att.type || 'document',
      uploadedBy: (att.uploadedBy && mongoose.Types.ObjectId.isValid(String(att.uploadedBy)))
        ? new mongoose.Types.ObjectId(String(att.uploadedBy))
        : (creatorId || undefined),
      uploadedAt: att.uploadedAt && !isNaN(new Date(att.uploadedAt).getTime()) ? new Date(att.uploadedAt) : new Date()
    })).filter(att => !!att.fileUrl) : [];

    // Safely parse dueDate
    let parsedDueDate = null;
    if (dueDate) {
      const d = new Date(dueDate);
      if (!isNaN(d.getTime())) {
        parsedDueDate = d;
      }
    }

    // Prevent rapid double-click duplicate task creation (within 3 seconds)
    const duplicateQuery = {
      title: title.trim(),
      department,
      createdAt: { $gte: new Date(Date.now() - 3000) }
    };
    if (creatorId) duplicateQuery.createdBy = creatorId;

    const recentDuplicate = await Task.findOne(duplicateQuery)
      .populate('assignees', 'name email role department avatar')
      .populate('createdBy', 'name email role avatar')
      .populate('attachments.uploadedBy', 'name email');

    if (recentDuplicate) {
      return res.status(409).json({
        success: false,
        message: 'A task with this title was just created moments ago. If this was intentional, please wait 3 seconds.'
      });
    }

    const normalizedStatus = normalizeTaskStatus(status);
    const normalizedPriority = normalizeTaskPriority(priority);
    const formattedRecurrence = recurrence && typeof recurrence === 'object'
      ? {
          isRecurring: Boolean(recurrence.isRecurring),
          frequency: ['daily', 'weekly', 'monthly', 'custom'].includes(String(recurrence.frequency || '').toLowerCase())
            ? String(recurrence.frequency).toLowerCase()
            : 'daily',
          intervalDays: Math.max(1, Number(recurrence.intervalDays || recurrence.interval || 1) || 1),
          nextRunDate: recurrence.nextRunDate ? new Date(recurrence.nextRunDate) : undefined
        }
      : { isRecurring: false, frequency: 'daily', intervalDays: 1 };

    const task = await Task.create({
      title: title.trim(),
      description: (description || '').trim(),
      priority: normalizedPriority,
      status: normalizedStatus,
      department,
      projectRef: (projectRef || '').trim(),
      clientName: (clientName || '').trim(),
      lotNo: (lotNo || '').trim(),
      dueDate: parsedDueDate,
      estimatedHours: Number(estimatedHours) || 0,
      assignees: finalAssignees,
      dependencies: validDependencies,
      checklist: Array.isArray(checklist)
        ? checklist
            .filter(c => c && (c.text || c.title))
            .map(c => ({
              text: String(c.text || c.title).trim(),
              completed: Boolean(c.completed),
              assignedTo: c.assignedTo || null
            }))
        : [],
      tags: Array.isArray(tags) ? tags : [],
      attachments: formattedAttachments,
      images: Array.isArray(images) ? images : formattedAttachments.filter(a => /\.(jpg|jpeg|png|webp|gif)$/i.test(a.fileName)).map(a => a.fileUrl),
      recurrence: formattedRecurrence,
      createdBy: creatorId || undefined,
      auditLogs: initialAudit
    });

    const populated = await populateTaskById(task._id);

    // Respond IMMEDIATELY with HTTP 201 Created to completely prevent frontend 500 timeouts
    res.status(201).json({ success: true, data: populated });

    // Asynchronously dispatch Web Push & Socket.io in background without blocking response
    setImmediate(async () => {
      try {
        const creatorIdStr = creatorId ? String(creatorId) : '';
        const recipientAssigneeIds = (finalAssignees || [])
          .map(a => String(typeof a === 'object' ? (a._id || a.id) : a))
          .filter(id => id && id !== creatorIdStr);

        // 1. Dispatch Web Push notification
        if (recipientAssigneeIds.length > 0 && webPushService && typeof webPushService.dispatchTaskNotification === 'function') {
          webPushService.dispatchTaskNotification(recipientAssigneeIds, {
            taskId: String(task._id),
            title: task.title,
            priority: task.priority,
            department: task.department,
            dueDate: task.dueDate,
            createdByName: createdByName || (req.user ? (req.user.name || req.user.username) : 'Admin'),
            projectRef: task.projectRef
          }).catch(err => console.warn('[TaskController] Push notification dispatch notice:', err.message));
        }

        // 2. Real-time Socket.IO Alert & Board Sync
        const io = req.app && typeof req.app.get === 'function' ? req.app.get('socketio') : null;
        if (io) {
          recipientAssigneeIds.forEach(uId => {
            io.to(`user_${uId}`).emit('task-assigned', {
              taskId: String(task._id),
              task: populated,
              title: task.title,
              priority: task.priority,
              department: task.department,
              dueDate: task.dueDate,
              createdByName: createdByName || (req.user ? (req.user.name || req.user.username) : 'Admin'),
              projectRef: task.projectRef,
              message: `📋 New Task Assigned: "${task.title}"`
            });
          });

          // Broadcast to all active users so Kanban/List boards update instantly
          io.emit('task-created', populated);
        }
      } catch (bgErr) {
        console.warn('[TaskController] Background task notification error (handled):', bgErr.message);
      }
    });
  } catch (error) {
    console.error('Error creating task:', error);
    res.status(500).json({ success: false, message: 'Failed to create task', error: error.message });
  }
};

/**
 * Update an existing task with Dependency Enforcement & Audit Logging
 */
const updateTask = async (req, res) => {
  try {
    const { id } = req.params;
    const updates = { ...req.body };
    const userId = req.user ? req.user._id : (updates.userId || null);
    const userName = updates.userName || (req.user ? req.user.name : 'Staff');

    const task = await Task.findById(id).populate('dependencies');
    if (!task) {
      return res.status(404).json({ success: false, message: 'Task not found' });
    }

    const previousStatus = task.status;
    if (updates.status !== undefined) {
      updates.status = normalizeTaskStatus(updates.status);
    }
    if (updates.priority !== undefined) {
      updates.priority = normalizeTaskPriority(updates.priority);
    }
    if (updates.recurrence && typeof updates.recurrence === 'object') {
      updates.recurrence = {
        isRecurring: Boolean(updates.recurrence.isRecurring),
        frequency: ['daily', 'weekly', 'monthly', 'custom'].includes(String(updates.recurrence.frequency || '').toLowerCase())
          ? String(updates.recurrence.frequency).toLowerCase()
          : 'daily',
        intervalDays: Math.max(1, Number(updates.recurrence.intervalDays || updates.recurrence.interval || 1) || 1),
        nextRunDate: updates.recurrence.nextRunDate ? new Date(updates.recurrence.nextRunDate) : undefined
      };
    }

    // Dependency Enforcement: Cannot set status to 'Done' if any open blocking dependencies exist
    if (updates.status === 'Done') {
      const openDependencies = (task.dependencies || []).filter(dep => dep.status !== 'Done');
      if (openDependencies.length > 0) {
        const titles = openDependencies.map(d => `"${d.title}"`).join(', ');
        return res.status(400).json({
          success: false,
          message: `Cannot mark task as Done! The following blocking dependent tasks are still open: ${titles}`
        });
      }
    }

    // Track old assignees to detect newly added assignees
    const oldAssigneeIds = (task.assignees || []).map(a => String(typeof a === 'object' ? (a._id || a.id) : a));

    // Generate Audit Log for key changes
    const auditEntries = [];
    if (updates.status && updates.status !== task.status) {
      auditEntries.push({
        user: userId,
        userName,
        fieldChanged: 'Status',
        oldValue: task.status,
        newValue: updates.status,
        timestamp: new Date()
      });
    }

    if (updates.priority && updates.priority !== task.priority) {
      auditEntries.push({
        user: userId,
        userName,
        fieldChanged: 'Priority',
        oldValue: task.priority,
        newValue: updates.priority,
        timestamp: new Date()
      });
    }

    if (updates.department && updates.department !== task.department) {
      auditEntries.push({
        user: userId,
        userName,
        fieldChanged: 'Department',
        oldValue: task.department,
        newValue: updates.department,
        timestamp: new Date()
      });
    }

    if (updates.title && updates.title !== task.title) {
      auditEntries.push({
        user: userId,
        userName,
        fieldChanged: 'Title',
        oldValue: task.title,
        newValue: updates.title,
        timestamp: new Date()
      });
    }

    if (auditEntries.length > 0) {
      if (!task.auditLogs) task.auditLogs = [];
      task.auditLogs.push(...auditEntries);
    }

    // Sanitize dates and hours
    if ('title' in updates && updates.title) {
      if (updates.title.trim().length > 200) {
        return res.status(400).json({ success: false, message: 'Task title cannot exceed 200 characters.' });
      }
      updates.title = updates.title.trim();
    }
    if ('dueDate' in updates) {
      updates.dueDate = updates.dueDate ? new Date(updates.dueDate) : null;
    }
    if ('estimatedHours' in updates) {
      const parsedHours = Number(updates.estimatedHours) || 0;
      if (parsedHours < 0 || parsedHours > 1000) {
        return res.status(400).json({ success: false, message: 'Estimated hours must be between 0 and 1,000.' });
      }
      updates.estimatedHours = parsedHours;
    }

    // Apply updates
    Object.keys(updates).forEach(key => {
      if (key !== 'userId' && key !== 'userName' && key !== '_id') {
        task[key] = updates[key];
      }
    });

    await task.save();

    // If a recurring task just transitioned to 'Done', automatically spawn the next occurrence
    const io = req.app.get('socketio');
    if (previousStatus !== 'Done' && task.status === 'Done' && task.recurrence && task.recurrence.isRecurring) {
      try {
        const freq = task.recurrence.frequency || 'daily';
        const stepDays = freq === 'daily' ? 1 : freq === 'weekly' ? 7 : freq === 'monthly' ? 30 : Math.max(1, Number(task.recurrence.intervalDays) || 1);
        const baseDate = task.dueDate ? new Date(task.dueDate) : new Date();
        const nextDueDate = new Date(baseDate.getTime() + stepDays * 24 * 60 * 60 * 1000);

        const spawnedTask = await Task.create({
          title: task.title,
          description: task.description || '',
          priority: task.priority,
          status: 'To Do',
          department: task.department,
          projectRef: task.projectRef || '',
          clientName: task.clientName || '',
          lotNo: task.lotNo || '',
          dueDate: nextDueDate,
          estimatedHours: task.estimatedHours || 0,
          assignees: task.assignees || [],
          checklist: (task.checklist || []).map(c => ({
            text: c.text,
            completed: false,
            assignedTo: c.assignedTo || null
          })),
          tags: task.tags || [],
          recurrence: {
            isRecurring: true,
            frequency: freq,
            intervalDays: stepDays,
            nextRunDate: nextDueDate
          },
          createdBy: task.createdBy,
          auditLogs: [{
            user: userId || task.createdBy,
            userName: 'Recurring Task Scheduler',
            fieldChanged: 'Recurring Task Spawned',
            oldValue: String(task._id),
            newValue: `Spawned next ${freq} occurrence due ${nextDueDate.toISOString().split('T')[0]}`,
            timestamp: new Date()
          }]
        });

        // Turn off recurrence on the completed instance so re-editing it doesn't spawn duplicates
        task.recurrence.isRecurring = false;
        await task.save();

        if (io) {
          const populatedSpawned = await populateTaskById(spawnedTask._id);
          io.emit('task-created', populatedSpawned);
        }
      } catch (recErr) {
        console.warn('[TaskController] Failed to spawn next recurring task occurrence:', recErr.message);
      }
    }

    const updatedTask = await populateTaskById(id);

    // Detect newly added assignees for push and socket notifications
    const newAssigneeIds = (updatedTask.assignees || []).map(a => String(typeof a === 'object' ? (a._id || a.id) : a));
    const userIdStr = userId ? String(userId) : '';
    const newlyAddedAssignees = newAssigneeIds.filter(aId => aId && !oldAssigneeIds.includes(aId) && aId !== userIdStr);

    if (newlyAddedAssignees.length > 0 && webPushService && typeof webPushService.dispatchTaskNotification === 'function') {
      webPushService.dispatchTaskNotification(newlyAddedAssignees, {
        taskId: String(id),
        title: updatedTask.title,
        priority: updatedTask.priority,
        department: updatedTask.department,
        dueDate: updatedTask.dueDate,
        createdByName: userName,
        projectRef: updatedTask.projectRef
      }).catch(err => console.warn('[TaskController] Push notification dispatch notice on updateTask:', err.message));
    }

    // Real-time socket broadcast
    if (io) {
      newlyAddedAssignees.forEach(uId => {
        io.to(`user_${uId}`).emit('task-assigned', {
          taskId: String(id),
          task: updatedTask,
          title: updatedTask.title,
          priority: updatedTask.priority,
          department: updatedTask.department,
          dueDate: updatedTask.dueDate,
          createdByName: userName,
          projectRef: updatedTask.projectRef,
          message: `📋 Task Assigned: "${updatedTask.title}"`
        });
      });

      // Broadcast task update so all users see changes immediately
      io.emit('task-updated', updatedTask);
    }

    res.json({ success: true, data: updatedTask });
  } catch (error) {
    console.error('Error updating task:', error);
    res.status(500).json({ success: false, message: 'Failed to update task', error: error.message });
  }
};

/**
 * Delete a task
 */
const deleteTask = async (req, res) => {
  try {
    if (!req.user || !req.user._id) {
      return res.status(401).json({
        success: false,
        code: 'UNAUTHORIZED',
        message: 'Authentication required. Please provide a valid Bearer token.'
      });
    }

    const { id } = req.params;
    let existingTask = null;

    if (id && mongoose.Types.ObjectId.isValid(String(id))) {
      existingTask = await Task.findById(id);
    } else if (id) {
      existingTask = await Task.findOne({
        $or: [{ projectRef: String(id) }, { title: String(id) }]
      });
    }

    if (!existingTask) {
      // Idempotent: Deleting an already-deleted or non-existent task is considered success
      return res.status(200).json({ success: true, message: 'Task already deleted or not found', taskId: id });
    }

    const userRole = (req.user?.role || '').toLowerCase();
    const isMasterAdmin =
      userRole === 'admin' ||
      userRole === 'super_admin' ||
      Boolean(req.user?.isMainAdmin) ||
      Boolean(req.user?.isAdmin);
    const isCreator = existingTask.createdBy && String(existingTask.createdBy) === String(req.user._id);

    if (!isMasterAdmin && !isCreator) {
      return res.status(403).json({
        success: false,
        message: 'Only the task creator or an administrator can delete this task'
      });
    }

    await Task.findByIdAndDelete(existingTask._id);

    // Broadcast real-time deletion
    const io = req.app.get('socketio');
    if (io) {
      io.emit('task-deleted', { taskId: String(existingTask._id), title: existingTask.title });
    }

    res.json({ success: true, message: 'Task deleted successfully', taskId: String(existingTask._id) });
  } catch (error) {
    console.error('Error deleting task:', error);
    res.status(500).json({ success: false, message: 'Failed to delete task', error: error.message });
  }
};

/**
 * Live Time Tracker - Start Timer
 */
const startTimer = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user ? req.user._id : (req.body.userId || req.query.userId);

    if (!userId) {
      return res.status(400).json({ success: false, message: 'User ID is required' });
    }

    const task = await Task.findById(id);
    if (!task) {
      return res.status(404).json({ success: false, message: 'Task not found' });
    }

    if (!task.liveTimers) task.liveTimers = [];

    // Check if timer is already running for this user on this task
    const existingIndex = task.liveTimers.findIndex(t => String(t.user) === String(userId) && t.isRunning);
    if (existingIndex >= 0) {
      const populatedExisting = await populateTaskById(id);
      return res.json({ success: true, data: populatedExisting, message: 'Timer is already running' });
    }

    task.liveTimers.push({
      user: userId,
      startTime: new Date(),
      isRunning: true
    });

    if (task.status === 'To Do' || task.status === 'Backlog') {
      task.status = 'In Progress';
    }

    await task.save();
    const populated = await populateTaskById(id);
    res.json({ success: true, data: populated });
  } catch (error) {
    console.error('Error starting task timer:', error);
    res.status(500).json({ success: false, message: 'Failed to start timer', error: error.message });
  }
};

/**
 * Live Time Tracker - Stop Timer & Save Log
 */
const stopTimer = async (req, res) => {
  try {
    const { id } = req.params;
    const { description = '', note = '', isBillable = true, userName = 'Staff' } = req.body;
    const userId = req.user ? req.user._id : (req.body.userId || req.query.userId);

    if (!userId) {
      return res.status(400).json({ success: false, message: 'User ID is required' });
    }

    const task = await Task.findById(id);
    if (!task) {
      return res.status(404).json({ success: false, message: 'Task not found' });
    }

    if (!task.liveTimers) task.liveTimers = [];

    const activeTimerIndex = task.liveTimers.findIndex(t => String(t.user) === String(userId) && t.isRunning);
    if (activeTimerIndex < 0) {
      return res.status(400).json({ success: false, message: 'No active timer found for this user' });
    }

    const timer = task.liveTimers[activeTimerIndex];
    const endTime = new Date();
    const startTime = new Date(timer.startTime);
    const durationMs = Math.max(0, endTime - startTime);
    const exactMinutes = durationMs / (1000 * 60);
    const durationMinutes = Math.max(1, Math.round(exactMinutes));
    const calculatedHours = durationMs / (1000 * 60 * 60);
    const hours = parseFloat(Math.max(0.01, calculatedHours).toFixed(2));

    // Remove active timer entry
    task.liveTimers.splice(activeTimerIndex, 1);

    // Only discard if timer was clicked and immediately stopped under 2 seconds
    if (durationMs < 2000) {
      await task.save();
      const populatedDiscarded = await populateTaskById(id);
      return res.json({ success: true, data: populatedDiscarded, loggedHours: 0, discarded: true, message: 'Timer discarded (accidental click under 2s)' });
    }

    // Save time log
    if (!task.timeLogs) task.timeLogs = [];
    task.timeLogs.push({
      user: userId,
      userName: req.user?.name || userName,
      hours,
      durationMinutes,
      startTime,
      endTime,
      description: description || note,
      isBillable,
      status: 'approved',
      createdAt: new Date()
    });

    await task.save();
    const populated = await populateTaskById(id);
    res.json({ success: true, data: populated, loggedHours: hours });
  } catch (error) {
    console.error('Error stopping task timer:', error);
    res.status(500).json({ success: false, message: 'Failed to stop timer', error: error.message });
  }
};

/**
 * Manual Time Entry
 */
const addManualTimeLog = async (req, res) => {
  try {
    const { id } = req.params;
    const { hours, durationMinutes, minutes, description = '', note = '', isBillable = true, userName = 'Staff' } = req.body;
    const userId = req.user ? req.user._id : (req.body.userId || req.query.userId);

    const resolvedMinutes = durationMinutes !== undefined ? Number(durationMinutes) : (minutes !== undefined ? Number(minutes) : null);
    const resolvedHours = hours !== undefined && hours !== '' ? Number(hours) : (resolvedMinutes !== null && !isNaN(resolvedMinutes) ? Number((resolvedMinutes / 60).toFixed(2)) : NaN);

    if (isNaN(resolvedHours) || resolvedHours <= 0) {
      return res.status(400).json({ success: false, message: 'Valid hours or durationMinutes amount is required' });
    }

    const task = await Task.findById(id);
    if (!task) {
      return res.status(404).json({ success: false, message: 'Task not found' });
    }

    if (!task.timeLogs) task.timeLogs = [];
    const numHours = Number(resolvedHours);
    task.timeLogs.push({
      user: userId,
      userName: req.user?.name || userName,
      hours: numHours,
      durationMinutes: resolvedMinutes !== null && !isNaN(resolvedMinutes) ? Math.round(resolvedMinutes) : Math.round(numHours * 60),
      description: description || note,
      isBillable,
      status: 'approved',
      createdAt: new Date()
    });

    await task.save();
    const populated = await populateTaskById(id);
    res.json({ success: true, data: populated });
  } catch (error) {
    console.error('Error adding manual time log:', error);
    res.status(500).json({ success: false, message: 'Failed to add time log', error: error.message });
  }
};

/**
 * Add Checklist Item
 */
const addChecklistItem = async (req, res) => {
  try {
    const { id } = req.params;
    const { text, title, assignedTo } = req.body;
    const itemText = text || title;

    if (!itemText || !String(itemText).trim()) {
      return res.status(400).json({ success: false, message: 'Checklist text is required' });
    }

    const task = await Task.findById(id);
    if (!task) {
      return res.status(404).json({ success: false, message: 'Task not found' });
    }

    if (!task.checklist) task.checklist = [];
    task.checklist.push({
      text: String(itemText).trim(),
      completed: false,
      assignedTo: assignedTo || null
    });

    await task.save();
    const populated = await populateTaskById(id);
    res.json({ success: true, data: populated });
  } catch (error) {
    console.error('Error adding checklist item:', error);
    res.status(500).json({ success: false, message: 'Failed to add checklist item', error: error.message });
  }
};

/**
 * Toggle Checklist Item Completion
 */
const toggleChecklistItem = async (req, res) => {
  try {
    const { id, itemId } = req.params;
    const { completed } = req.body;

    const task = await Task.findById(id);
    if (!task) {
      return res.status(404).json({ success: false, message: 'Task not found' });
    }

    const item = (task.checklist || []).id(itemId);
    if (!item) {
      return res.status(404).json({ success: false, message: 'Checklist item not found' });
    }

    item.completed = typeof completed === 'boolean' ? completed : !item.completed;
    await task.save();

    const populated = await populateTaskById(id);
    res.json({ success: true, data: populated });
  } catch (error) {
    console.error('Error toggling checklist item:', error);
    res.status(500).json({ success: false, message: 'Failed to toggle checklist item', error: error.message });
  }
};

/**
 * Add Comment to Task Thread
 */
const addComment = async (req, res) => {
  try {
    const { id } = req.params;
    const { text, senderName = 'Staff' } = req.body;
    const userId = req.user ? req.user._id : (req.body.userId || req.query.userId);
    const resolvedSenderName = req.user ? (req.user.name || req.user.username || senderName) : senderName;

    if (!text || !text.trim()) {
      return res.status(400).json({ success: false, message: 'Comment text is required' });
    }

    const task = await Task.findById(id);
    if (!task) {
      return res.status(404).json({ success: false, message: 'Task not found' });
    }

    if (!task.comments) task.comments = [];
    task.comments.push({
      sender: userId,
      senderName: resolvedSenderName,
      text: text.trim(),
      createdAt: new Date()
    });

    await task.save();
    const populated = await populateTaskById(id);
    res.json({ success: true, data: populated });
  } catch (error) {
    console.error('Error adding task comment:', error);
    res.status(500).json({ success: false, message: 'Failed to add comment', error: error.message });
  }
};

/**
 * Add Attachment to Task (stored in Cloudflare R2)
 */
const addAttachment = async (req, res) => {
  try {
    const { id } = req.params;
    const { fileName, fileUrl, fileSize = 0, fileType = 'document' } = req.body;
    const userId = req.user ? req.user._id : (req.body.userId || null);
    const userName = req.user ? (req.user.name || req.user.username) : (req.body.userName || 'Staff');

    if (!fileName || !fileUrl) {
      return res.status(400).json({ success: false, message: 'fileName and fileUrl are required' });
    }

    const task = await Task.findById(id);
    if (!task) {
      return res.status(404).json({ success: false, message: 'Task not found' });
    }

    if (!task.attachments) task.attachments = [];
    task.attachments.push({
      fileName,
      fileUrl,
      fileSize: Number(fileSize) || 0,
      fileType,
      uploadedBy: userId,
      uploadedAt: new Date()
    });

    if (fileType.startsWith('image/') || /\.(jpg|jpeg|png|webp|gif)$/i.test(fileName)) {
      if (!task.images) task.images = [];
      if (!task.images.includes(fileUrl)) {
        task.images.push(fileUrl);
      }
    }

    if (!task.auditLogs) task.auditLogs = [];
    task.auditLogs.push({
      user: userId,
      userName,
      fieldChanged: 'Attachment Added',
      oldValue: '',
      newValue: `Attached "${fileName}"`,
      timestamp: new Date()
    });

    await task.save();

    const populated = await populateTaskById(id);

    res.json({ success: true, data: populated });
  } catch (error) {
    console.error('Error adding task attachment:', error);
    res.status(500).json({ success: false, message: 'Failed to add attachment', error: error.message });
  }
};

/**
 * Delete Attachment from Task
 */
const deleteAttachment = async (req, res) => {
  try {
    const { id, attachmentId } = req.params;
    const userId = req.user ? req.user._id : (req.body?.userId || null);
    const userName = req.user ? (req.user.name || req.user.username) : (req.body?.userName || 'Staff');

    const task = await Task.findById(id);
    if (!task) {
      return res.status(404).json({ success: false, message: 'Task not found' });
    }

    const existingAtt = (task.attachments || []).find(a => String(a._id) === String(attachmentId));
    const attName = existingAtt ? existingAtt.fileName : 'attachment';

    task.attachments = (task.attachments || []).filter(a => String(a._id) !== String(attachmentId));
    if (existingAtt?.fileUrl && task.images) {
      task.images = task.images.filter(img => img !== existingAtt.fileUrl);
    }

    if (!task.auditLogs) task.auditLogs = [];
    task.auditLogs.push({
      user: userId,
      userName,
      fieldChanged: 'Attachment Removed',
      oldValue: `Removed "${attName}"`,
      newValue: '',
      timestamp: new Date()
    });

    await task.save();

    const populated = await populateTaskById(id);

    res.json({ success: true, data: populated });
  } catch (error) {
    console.error('Error deleting task attachment:', error);
    res.status(500).json({ success: false, message: 'Failed to delete attachment', error: error.message });
  }
};

/**
 * Delete Checklist Item
 */
const deleteChecklistItem = async (req, res) => {
  try {
    const { id, itemId } = req.params;
    const task = await Task.findById(id);
    if (!task) {
      return res.status(404).json({ success: false, message: 'Task not found' });
    }

    task.checklist = (task.checklist || []).filter(c => String(c._id) !== String(itemId));
    await task.save();
    const populated = await populateTaskById(id);
    res.json({ success: true, data: populated });
  } catch (error) {
    console.error('Error deleting checklist item:', error);
    res.status(500).json({ success: false, message: 'Failed to delete checklist item', error: error.message });
  }
};

/**
 * Edit Comment in Task Thread
 */
const editComment = async (req, res) => {
  try {
    const { id, commentId } = req.params;
    const { text } = req.body;

    if (!text || !text.trim()) {
      return res.status(400).json({ success: false, message: 'Comment text is required' });
    }

    const task = await Task.findById(id);
    if (!task) {
      return res.status(404).json({ success: false, message: 'Task not found' });
    }

    const comment = (task.comments || []).id(commentId);
    if (!comment) {
      return res.status(404).json({ success: false, message: 'Comment not found' });
    }

    const userRole = (req.user?.role || '').toLowerCase();
    const isMasterAdmin =
      userRole === 'admin' ||
      userRole === 'super_admin' ||
      Boolean(req.user?.isMainAdmin) ||
      Boolean(req.user?.isAdmin);
    const isCommentAuthor = req.user && comment.sender && String(comment.sender) === String(req.user._id);

    if (!isMasterAdmin && !isCommentAuthor) {
      return res.status(403).json({
        success: false,
        message: 'You can only edit your own comments'
      });
    }

    comment.text = text.trim();
    comment.editedAt = new Date();
    await task.save();

    const populated = await populateTaskById(id);
    res.json({ success: true, data: populated });
  } catch (error) {
    console.error('Error editing comment:', error);
    res.status(500).json({ success: false, message: 'Failed to edit comment', error: error.message });
  }
};

/**
 * Delete Comment from Task Thread
 */
const deleteComment = async (req, res) => {
  try {
    const { id, commentId } = req.params;
    const task = await Task.findById(id);
    if (!task) {
      return res.status(404).json({ success: false, message: 'Task not found' });
    }

    const comment = (task.comments || []).id(commentId);
    if (!comment) {
      return res.status(404).json({ success: false, message: 'Comment not found' });
    }

    const userRole = (req.user?.role || '').toLowerCase();
    const isMasterAdmin =
      userRole === 'admin' ||
      userRole === 'super_admin' ||
      Boolean(req.user?.isMainAdmin) ||
      Boolean(req.user?.isAdmin);
    const isCommentAuthor = req.user && comment.sender && String(comment.sender) === String(req.user._id);

    if (!isMasterAdmin && !isCommentAuthor) {
      return res.status(403).json({
        success: false,
        message: 'You can only delete your own comments'
      });
    }

    task.comments = (task.comments || []).filter(c => String(c._id) !== String(commentId));
    await task.save();

    const populated = await populateTaskById(id);
    res.json({ success: true, data: populated });
  } catch (error) {
    console.error('Error deleting comment:', error);
    res.status(500).json({ success: false, message: 'Failed to delete comment', error: error.message });
  }
};

/**
 * Check for tasks that have passed their due date without being marked as 'Done'
 */
const checkOverdueTasks = async (io) => {
  try {
    // In IST (Asia/Kolkata), today is only overdue after 23:59:59 IST.
    // Tasks due today are NOT overdue until tomorrow starts.
    const now = new Date();
    const istOffset = 5.5 * 60 * 60 * 1000;
    const istNow = new Date(now.getTime() + istOffset);
    const todayISTString = istNow.toISOString().split('T')[0];
    const startOfTodayIST = new Date(`${todayISTString}T00:00:00.000+05:30`);

    const overdueTasks = await Task.find({
      dueDate: { $ne: null, $lt: startOfTodayIST },
      status: { $ne: 'Done' },
      overdueNotified: { $ne: true }
    })
    .populate('assignees', 'name email role')
    .populate('createdBy', 'name email role');

    if (overdueTasks.length === 0) return;

    const { publishActivity } = require('../utils/activityEvent');

    for (const task of overdueTasks) {
      task.overdueNotified = true;
      await task.save();

      const dueDateStr = task.dueDate ? new Date(task.dueDate).toLocaleDateString('en-GB', { timeZone: 'Asia/Kolkata' }) : 'due date';
      const desc = `🚨 **OVERDUE TASK ALERT**: Task "${task.title}" was due on ${dueDateStr} and is NOT finished!`;

      await publishActivity({
        actorId: task.createdBy ? (task.createdBy._id || task.createdBy) : null,
        actorName: 'System Alert',
        action: 'OVERDUE_ALERT',
        module: 'Task Management',
        recordRef: task.projectRef || task.title,
        recordId: String(task._id),
        permissionScope: 'jobcards',
        department: task.department || 'General',
        description: desc
      });

      if (io) {
        const recipientIds = new Set([
          ...(task.assignees || []).map(a => String(a._id || a)),
          task.createdBy ? String(task.createdBy._id || task.createdBy) : null
        ].filter(Boolean));

        recipientIds.forEach(uId => {
          io.to(`user_${uId}`).emit('overdue-task-alert', {
            taskId: task._id,
            title: task.title,
            dueDate: task.dueDate,
            message: `🚨 Task "${task.title}" is OVERDUE! It was due on ${dueDateStr} and is not finished yet.`
          });
        });
      }
    }
  } catch (err) {
    console.error('Error checking overdue tasks:', err);
  }
};

module.exports = {
  getTasks,
  getTaskById,
  createTask,
  updateTask,
  deleteTask,
  startTimer,
  stopTimer,
  addManualTimeLog,
  addChecklistItem,
  toggleChecklistItem,
  deleteChecklistItem,
  addComment,
  editComment,
  deleteComment,
  addAttachment,
  deleteAttachment,
  checkOverdueTasks
};
