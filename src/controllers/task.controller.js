const mongoose = require('mongoose');
const { Task } = require('../db/models/task.model');
const { user: User } = require('../db/models');

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
      projectRef,
      search,
      page = 1,
      limit = 100,
      sortBy = 'createdAt',
      sortOrder = 'desc'
    } = req.query;

    const query = {};

    if (status && status !== 'all') {
      query.status = status;
    }
    if (priority && priority !== 'all') {
      query.priority = priority;
    }
    if (department && department !== 'all') {
      query.department = department;
    }
    if (projectRef) {
      query.projectRef = { $regex: projectRef, $options: 'i' };
    }
    if (assignee) {
      query.assignees = new mongoose.Types.ObjectId(assignee);
    }

    if (search && search.trim()) {
      const term = search.trim();
      query.$or = [
        { title: { $regex: term, $options: 'i' } },
        { description: { $regex: term, $options: 'i' } },
        { projectRef: { $regex: term, $options: 'i' } },
        { clientName: { $regex: term, $options: 'i' } },
      ];
    }

    const pageNum = parseInt(page, 10);
    const limitNum = parseInt(limit, 10);
    const skip = (pageNum - 1) * limitNum;
    const sort = { [sortBy]: sortOrder === 'asc' ? 1 : -1 };

    const total = await Task.countDocuments(query);
    const tasks = await Task.find(query)
      .populate('assignees', 'name email role department')
      .populate('createdBy', 'name email role')
      .populate('dependencies', 'title status priority')
      .sort(sort)
      .skip(skip)
      .limit(limitNum);

    // Trigger async overdue tasks check
    checkOverdueTasks(req.app.get('socketio')).catch(e => console.error('Overdue check error:', e));

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
      .populate('dependencies', 'title status priority assignees');

    if (!task) {
      return res.status(404).json({ success: false, message: 'Task not found' });
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
      dueDate,
      estimatedHours = 0,
      assignees = [],
      dependencies = [],
      checklist = [],
      tags = [],
      createdBy: customCreatedBy,
      createdByName = 'Admin'
    } = req.body;

    if (!title || !title.trim()) {
      return res.status(400).json({ success: false, message: 'Task title is required' });
    }

    const creatorId = req.user ? req.user._id : (customCreatedBy || null);

    const initialAudit = [{
      user: creatorId,
      userName: createdByName,
      fieldChanged: 'Task Created',
      oldValue: '',
      newValue: `Created "${title.trim()}" in ${department}`,
      timestamp: new Date()
    }];

    const task = await Task.create({
      title: title.trim(),
      description: description.trim(),
      priority,
      status,
      department,
      projectRef: projectRef.trim(),
      clientName: clientName.trim(),
      dueDate: dueDate ? new Date(dueDate) : null,
      estimatedHours: Number(estimatedHours) || 0,
      assignees,
      dependencies,
      checklist,
      tags,
      createdBy: creatorId,
      auditLogs: initialAudit
    });

    const populated = await Task.findById(task._id)
      .populate('assignees', 'name email role department')
      .populate('createdBy', 'name email role');

    res.status(201).json({ success: true, data: populated });
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

    if (auditEntries.length > 0) {
      if (!task.auditLogs) task.auditLogs = [];
      task.auditLogs.push(...auditEntries);
    }

    // Apply updates
    Object.keys(updates).forEach(key => {
      if (key !== 'userId' && key !== 'userName' && key !== '_id') {
        task[key] = updates[key];
      }
    });

    await task.save();

    const updatedTask = await Task.findById(id)
      .populate('assignees', 'name email role department')
      .populate('createdBy', 'name email role')
      .populate('dependencies', 'title status priority');

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
    const { id } = req.params;
    const task = await Task.findByIdAndDelete(id);
    if (!task) {
      return res.status(404).json({ success: false, message: 'Task not found' });
    }
    res.json({ success: true, message: 'Task deleted successfully' });
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
      return res.json({ success: true, data: task, message: 'Timer is already running' });
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
    res.json({ success: true, data: task });
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
    const { description = '', isBillable = true, userName = 'Staff' } = req.body;
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
    const durationMinutes = Math.round(durationMs / (1000 * 60));
    const hours = parseFloat((durationMinutes / 60).toFixed(2));

    // Remove active timer entry
    task.liveTimers.splice(activeTimerIndex, 1);

    // Save time log
    if (!task.timeLogs) task.timeLogs = [];
    task.timeLogs.push({
      user: userId,
      userName,
      hours,
      durationMinutes,
      startTime,
      endTime,
      description,
      isBillable,
      status: 'approved',
      createdAt: new Date()
    });

    await task.save();
    res.json({ success: true, data: task, loggedHours: hours });
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
    const { hours, description = '', isBillable = true, userName = 'Staff' } = req.body;
    const userId = req.user ? req.user._id : (req.body.userId || req.query.userId);

    if (!hours || isNaN(hours) || Number(hours) <= 0) {
      return res.status(400).json({ success: false, message: 'Valid hours amount is required' });
    }

    const task = await Task.findById(id);
    if (!task) {
      return res.status(404).json({ success: false, message: 'Task not found' });
    }

    if (!task.timeLogs) task.timeLogs = [];
    const numHours = Number(hours);
    task.timeLogs.push({
      user: userId,
      userName,
      hours: numHours,
      durationMinutes: Math.round(numHours * 60),
      description,
      isBillable,
      status: 'approved',
      createdAt: new Date()
    });

    await task.save();
    res.json({ success: true, data: task });
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
    const { text, assignedTo } = req.body;

    if (!text || !text.trim()) {
      return res.status(400).json({ success: false, message: 'Checklist text is required' });
    }

    const task = await Task.findById(id);
    if (!task) {
      return res.status(404).json({ success: false, message: 'Task not found' });
    }

    if (!task.checklist) task.checklist = [];
    task.checklist.push({
      text: text.trim(),
      completed: false,
      assignedTo: assignedTo || null
    });

    await task.save();
    res.json({ success: true, data: task });
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

    res.json({ success: true, data: task });
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
      senderName,
      text: text.trim(),
      createdAt: new Date()
    });

    await task.save();
    res.json({ success: true, data: task });
  } catch (error) {
    console.error('Error adding task comment:', error);
    res.status(500).json({ success: false, message: 'Failed to add comment', error: error.message });
  }
};

/**
 * Check for tasks that have passed their due date without being marked as 'Done'
 */
const checkOverdueTasks = async (io) => {
  try {
    const now = new Date();
    const overdueTasks = await Task.find({
      dueDate: { $ne: null, $lt: now },
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

      const dueDateStr = task.dueDate ? new Date(task.dueDate).toLocaleDateString() : 'due date';
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
  addComment,
  checkOverdueTasks
};
