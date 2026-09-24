const mongoose = require('mongoose');
const db = require('../db/models');
const logger = require('../config/logger');
const { emitSocketEvent } = require('../utils/socketEmitHelper');

/**
 * Detect media type from URL (image vs video vs generic link)
 */
const detectLinkType = (url = '') => {
  if (!url || typeof url !== 'string') return 'link';
  const u = url.trim().toLowerCase();
  if (
    u.endsWith('.mp4') ||
    u.endsWith('.webm') ||
    u.endsWith('.mov') ||
    u.endsWith('.m4v') ||
    u.endsWith('.ogg') ||
    u.includes('youtube.com/watch') ||
    u.includes('youtu.be/') ||
    u.includes('youtube.com/shorts') ||
    u.includes('vimeo.com/') ||
    u.includes('/drive.google.com/file/d/') && (u.includes('video') || u.includes('preview'))
  ) {
    return 'video';
  }
  if (
    u.endsWith('.jpg') ||
    u.endsWith('.jpeg') ||
    u.endsWith('.png') ||
    u.endsWith('.webp') ||
    u.endsWith('.gif') ||
    u.endsWith('.svg') ||
    u.includes('drive.google.com/uc?id=') ||
    u.includes('r2.dev/')
  ) {
    return 'image';
  }
  return 'link';
};

/**
 * Helper to generate next task number (e.g. DES-1001, DES-1002)
 */
const getNextTaskNo = async () => {
  try {
    const latest = await db.DesignerTask.findOne({ taskNo: { $regex: /^DES-\d+$/i } })
      .sort({ createdAt: -1 })
      .lean();

    if (latest && latest.taskNo) {
      const match = latest.taskNo.match(/\d+/);
      if (match) {
        const nextNum = parseInt(match[0], 10) + 1;
        return `DES-${nextNum}`;
      }
    }
    const count = await db.DesignerTask.countDocuments();
    return `DES-${1001 + count}`;
  } catch (e) {
    return `DES-${Date.now().toString().slice(-5)}`;
  }
};

/**
 * Create a new designer task (from Admin)
 */
const createDesignerTask = async (req, res) => {
  try {
    const body = { ...req.body };

    if (!body.designName && !body.title) {
      return res.status(400).json({ error: 'Design Name is required.' });
    }
    if (!body.designName && body.title) {
      body.designName = body.title;
    }

    if (!body.taskNo) {
      body.taskNo = await getNextTaskNo();
    } else {
      // Ensure unique
      const existing = await db.DesignerTask.findOne({ taskNo: body.taskNo }).lean();
      if (existing) {
        body.taskNo = await getNextTaskNo();
      }
    }

    // Handle multiple fabrics, designers, colour matches
    if (Array.isArray(body.fabrics)) {
      body.fabricName = body.fabrics.filter(Boolean).join(', ');
    } else if (body.fabricName) {
      body.fabrics = body.fabricName.split(',').map(s => s.trim()).filter(Boolean);
    }

    if (Array.isArray(body.designers)) {
      body.designerName = body.designers.filter(Boolean).join(', ');
    } else if (body.designerName) {
      body.designers = body.designerName.split(',').map(s => s.trim()).filter(Boolean);
    }

    if (Array.isArray(body.colourMatches)) {
      body.colourMatching = body.colourMatches.filter(Boolean).join(', ');
    } else if (body.colourMatching) {
      body.colourMatches = body.colourMatching.split(',').map(s => s.trim()).filter(Boolean);
    }

    // Default date to today (YYYY-MM-DD)
    if (!body.date) {
      body.date = new Date().toISOString().split('T')[0];
    }

    // Detect link type
    if (body.sampleLink) {
      body.sampleLinkType = detectLinkType(body.sampleLink);
    }

    const creatorName = req.user?.name || req.headers['x-user-name'] || body.createdByName || 'Admin';
    const creatorId = req.user?._id || req.headers['x-user-id'] || body.createdById || '';
    body.createdByName = creatorName;
    body.createdById = String(creatorId);

    const initialStage = body.status || 'New';
    body.status = initialStage;
    body.stageHistory = [
      {
        stage: initialStage,
        updatedBy: String(creatorId),
        updatedByName: creatorName,
        updatedAt: new Date(),
        note: body.notes ? `Created: ${body.notes.slice(0, 100)}` : 'Design task created from Admin',
        outputImage: body.sampleImage || '',
        outputLink: body.sampleLink || '',
      },
    ];

    const task = await db.DesignerTask.create(body);

    emitSocketEvent(req, 'designer-task-created', task);

    return res.status(201).json({ success: true, data: task });
  } catch (err) {
    logger.error('createDesignerTask error: %o', err);
    return res.status(500).json({ error: err.message || 'Failed to create designer task' });
  }
};

/**
 * Get designer tasks with multi-filter history support
 */
const getDesignerTasks = async (req, res) => {
  try {
    const {
      date,
      startDate,
      endDate,
      designerName,
      colourMatching,
      fabricName,
      priority,
      status,
      search,
      sortBy = 'createdAt',
      sortOrder = 'desc',
      limit = 200,
    } = req.query;

    const filter = {};

    // Single Date or Date Range filter
    if (date && date.trim()) {
      filter.date = date.trim();
    } else if (startDate || endDate) {
      filter.date = {};
      if (startDate && startDate.trim()) filter.date.$gte = startDate.trim();
      if (endDate && endDate.trim()) filter.date.$lte = endDate.trim();
    }

    // Designer filter (supports partial match for multiple designers)
    if (designerName && designerName.trim() && designerName !== 'All') {
      const esc = designerName.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      filter.designerName = { $regex: new RegExp(esc, 'i') };
    }

    // Colour Matching filter
    if (colourMatching && colourMatching.trim() && colourMatching !== 'All') {
      const esc = colourMatching.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      filter.colourMatching = { $regex: new RegExp(esc, 'i') };
    }

    // Fabric filter
    if (fabricName && fabricName.trim() && fabricName !== 'All') {
      const esc = fabricName.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      filter.fabricName = { $regex: new RegExp(esc, 'i') };
    }

    // Priority filter
    if (priority && priority.trim() && priority !== 'All') {
      filter.priority = priority.trim();
    }

    // Status / Stage filter
    if (status && status.trim() && status !== 'All') {
      filter.status = status.trim();
    }

    // Text search filter
    if (search && search.trim()) {
      const q = search.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      filter.$or = [
        { taskNo: { $regex: q, $options: 'i' } },
        { designName: { $regex: q, $options: 'i' } },
        { designerName: { $regex: q, $options: 'i' } },
        { fabricName: { $regex: q, $options: 'i' } },
        { colourMatching: { $regex: q, $options: 'i' } },
        { notes: { $regex: q, $options: 'i' } },
      ];
    }

    const sort = {};
    sort[sortBy] = sortOrder === 'asc' ? 1 : -1;

    const tasks = await db.DesignerTask.find(filter)
      .sort(sort)
      .limit(parseInt(limit, 10) || 500)
      .lean();

    return res.status(200).json({
      success: true,
      count: tasks.length,
      data: tasks,
    });
  } catch (err) {
    logger.error('getDesignerTasks error: %o', err);
    return res.status(500).json({ error: err.message || 'Failed to fetch designer tasks' });
  }
};

/**
 * Get single task detail with full history
 */
const getDesignerTaskById = async (req, res) => {
  try {
    const { id } = req.params;
    let task = null;
    if (mongoose.Types.ObjectId.isValid(id)) {
      task = await db.DesignerTask.findById(id).lean();
    }
    if (!task) {
      task = await db.DesignerTask.findOne({ taskNo: id }).lean();
    }
    if (!task) {
      return res.status(404).json({ error: 'Designer task not found' });
    }
    return res.status(200).json({ success: true, data: task });
  } catch (err) {
    logger.error('getDesignerTaskById error: %o', err);
    return res.status(500).json({ error: err.message || 'Failed to fetch task' });
  }
};

/**
 * Update task attributes
 */
const updateDesignerTask = async (req, res) => {
  try {
    const { id } = req.params;
    const body = { ...req.body };
    delete body._id;
    delete body.id;

    let task = await db.DesignerTask.findById(id);
    if (!task) {
      task = await db.DesignerTask.findOne({ taskNo: id });
    }
    if (!task) {
      return res.status(404).json({ error: 'Designer task not found' });
    }

    const editorName = req.user?.name || req.headers['x-user-name'] || 'Admin';
    const editorId = req.user?._id || req.headers['x-user-id'] || '';

    // Handle multiple fabrics, designers, colour matches
    if (Array.isArray(body.fabrics)) {
      body.fabricName = body.fabrics.filter(Boolean).join(', ');
    } else if (body.fabricName !== undefined) {
      body.fabrics = body.fabricName ? body.fabricName.split(',').map(s => s.trim()).filter(Boolean) : [];
    }

    if (Array.isArray(body.designers)) {
      body.designerName = body.designers.filter(Boolean).join(', ');
    } else if (body.designerName !== undefined) {
      body.designers = body.designerName ? body.designerName.split(',').map(s => s.trim()).filter(Boolean) : [];
    }

    if (Array.isArray(body.colourMatches)) {
      body.colourMatching = body.colourMatches.filter(Boolean).join(', ');
    } else if (body.colourMatching !== undefined) {
      body.colourMatches = body.colourMatching ? body.colourMatching.split(',').map(s => s.trim()).filter(Boolean) : [];
    }

    // If status changed, record in stageHistory
    if (body.status && body.status !== task.status) {
      task.stageHistory.push({
        stage: body.status,
        updatedBy: String(editorId),
        updatedByName: editorName,
        updatedAt: new Date(),
        note: body.stageNote || `Stage changed to ${body.status}`,
        outputImage: body.outputImage || task.outputImage || '',
        outputLink: body.outputLink || task.outputLink || '',
      });
      task.status = body.status;
    }

    if (body.sampleLink) {
      body.sampleLinkType = detectLinkType(body.sampleLink);
    }

    Object.assign(task, body);
    await task.save();

    emitSocketEvent(req, 'designer-task-updated', task);

    return res.status(200).json({ success: true, data: task });
  } catch (err) {
    logger.error('updateDesignerTask error: %o', err);
    return res.status(500).json({ error: err.message || 'Failed to update designer task' });
  }
};

/**
 * Update task stage directly with note / output files
 */
const updateTaskStage = async (req, res) => {
  try {
    const { id } = req.params;
    const { stage, note = '', outputImage = '', outputLink = '' } = req.body;

    if (!stage) {
      return res.status(400).json({ error: 'Stage is required' });
    }

    let task = await db.DesignerTask.findById(id);
    if (!task) {
      task = await db.DesignerTask.findOne({ taskNo: id });
    }
    if (!task) {
      return res.status(404).json({ error: 'Designer task not found' });
    }

    const editorName = req.user?.name || req.headers['x-user-name'] || 'Designer / Admin';
    const editorId = req.user?._id || req.headers['x-user-id'] || '';

    task.status = stage;
    if (outputImage) task.outputImage = outputImage;
    if (outputLink) task.outputLink = outputLink;

    task.stageHistory.push({
      stage,
      updatedBy: String(editorId),
      updatedByName: editorName,
      updatedAt: new Date(),
      note: note || `Stage updated to "${stage}"`,
      outputImage: outputImage || task.outputImage || '',
      outputLink: outputLink || task.outputLink || '',
    });

    await task.save();

    emitSocketEvent(req, 'designer-task-updated', task);

    return res.status(200).json({ success: true, data: task });
  } catch (err) {
    logger.error('updateTaskStage error: %o', err);
    return res.status(500).json({ error: err.message || 'Failed to update task stage' });
  }
};

/**
 * Delete designer task
 */
const deleteDesignerTask = async (req, res) => {
  try {
    const { id } = req.params;
    const deleted = await db.DesignerTask.findByIdAndDelete(id);
    if (!deleted) {
      return res.status(404).json({ error: 'Designer task not found' });
    }

    emitSocketEvent(req, 'designer-task-deleted', { id });

    return res.status(200).json({ success: true, message: 'Designer task deleted successfully' });
  } catch (err) {
    logger.error('deleteDesignerTask error: %o', err);
    return res.status(500).json({ error: err.message || 'Failed to delete designer task' });
  }
};

/**
 * Get dashboard stats for designer module
 */
const getDesignerStats = async (req, res) => {
  try {
    const [statusStats, priorityStats, totalCount] = await Promise.all([
      db.DesignerTask.aggregate([
        { $group: { _id: '$status', count: { $sum: 1 } } },
      ]),
      db.DesignerTask.aggregate([
        { $group: { _id: '$priority', count: { $sum: 1 } } },
      ]),
      db.DesignerTask.countDocuments(),
    ]);

    const statusMap = {};
    statusStats.forEach(s => { statusMap[s._id] = s.count; });

    const priorityMap = {};
    priorityStats.forEach(p => { priorityMap[p._id] = p.count; });

    return res.status(200).json({
      success: true,
      data: {
        total: totalCount,
        new: statusMap['New'] || 0,
        assigned: statusMap['Assigned'] || 0,
        inProgress: statusMap['In Progress'] || 0,
        colourMatching: statusMap['Colour Matching'] || 0,
        sampleReady: statusMap['Sample Proof Ready'] || 0,
        revision: statusMap['Revision Requested'] || 0,
        approved: statusMap['Approved'] || 0,
        cancelled: statusMap['Cancelled'] || 0,
        urgent: priorityMap['Urgent'] || 0,
        high: priorityMap['High'] || 0,
        medium: priorityMap['Medium'] || 0,
        low: priorityMap['Low'] || 0,
      },
    });
  } catch (err) {
    logger.error('getDesignerStats error: %o', err);
    return res.status(500).json({ error: err.message || 'Failed to fetch stats' });
  }
};

module.exports = {
  createDesignerTask,
  getDesignerTasks,
  getDesignerTaskById,
  updateDesignerTask,
  updateTaskStage,
  deleteDesignerTask,
  getDesignerStats,
};
