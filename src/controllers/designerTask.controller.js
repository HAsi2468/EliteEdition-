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
    if (req.user && req.user.role !== 'admin' && !req.user.isMainAdmin) {
      const allowed = req.user.canInputNewDesign || req.user.permissions?.includes('input_new_design');
      if (!allowed) {
        return res.status(403).json({ error: 'Access denied: You do not have permission to input new designs.' });
      }
    }

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
      drowDesignStatus,
      colourMatchingStatus,
      finalDesignStatus,
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

    const andConditions = [];

    // Assigned User filter (matches if user is in Designer OR in Colour Matching)
    const activeAssignedUser = (req.query.assignedUser || req.query.assignedName || '').trim();
    if (activeAssignedUser === '__NO_NAME_ASSIGNED__') {
      return res.status(200).json({ success: true, count: 0, total: 0, data: [] });
    }

    if (activeAssignedUser && activeAssignedUser !== 'All') {
      const esc = activeAssignedUser.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const reg = new RegExp(esc, 'i');
      andConditions.push({
        $or: [
          { designerName: { $regex: reg } },
          { designers: { $in: [new RegExp(`^${esc}$`, 'i'), reg] } },
          { designers: activeAssignedUser },
          { colourMatching: { $regex: reg } },
          { colourMatches: { $in: [new RegExp(`^${esc}$`, 'i'), reg] } },
          { colourMatches: activeAssignedUser },
        ],
      });
    } else {
      // Designer filter (matches designerName string or designers array)
      if (designerName && designerName.trim() && designerName !== 'All') {
        const esc = designerName.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        const reg = new RegExp(esc, 'i');
        andConditions.push({
          $or: [
            { designerName: { $regex: reg } },
            { designers: { $in: [new RegExp(`^${esc}$`, 'i'), reg] } },
            { designers: designerName.trim() },
          ],
        });
      }

      // Colour Matching filter (matches colourMatching string or colourMatches array)
      if (colourMatching && colourMatching.trim() && colourMatching !== 'All') {
        const esc = colourMatching.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        const reg = new RegExp(esc, 'i');
        andConditions.push({
          $or: [
            { colourMatching: { $regex: reg } },
            { colourMatches: { $in: [new RegExp(`^${esc}$`, 'i'), reg] } },
            { colourMatches: colourMatching.trim() },
          ],
        });
      }
    }

    // Fabric filter (matches fabricName string or fabrics array)
    if (fabricName && fabricName.trim() && fabricName !== 'All') {
      const esc = fabricName.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const reg = new RegExp(esc, 'i');
      andConditions.push({
        $or: [
          { fabricName: { $regex: reg } },
          { fabrics: { $in: [new RegExp(`^${esc}$`, 'i'), reg] } },
          { fabrics: fabricName.trim() },
        ],
      });
    }

    // Priority filter
    if (priority && priority.trim() && priority !== 'All') {
      filter.priority = priority.trim();
    }

    // Overall Status / Stage filter
    if (status && status.trim() && status !== 'All') {
      filter.status = status.trim();
    }

    // ─── Granular Workflow Status Filters ────────────────────────
    if (drowDesignStatus && drowDesignStatus.trim() && drowDesignStatus !== 'All') {
      filter.drowDesignStatus = drowDesignStatus.trim();
    }
    if (colourMatchingStatus && colourMatchingStatus.trim() && colourMatchingStatus !== 'All') {
      filter.colourMatchingStatus = colourMatchingStatus.trim();
    }
    if (finalDesignStatus && finalDesignStatus.trim() && finalDesignStatus !== 'All') {
      filter.finalDesignStatus = finalDesignStatus.trim();
    }

    // Text search filter
    if (search && search.trim()) {
      const q = search.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      andConditions.push({
        $or: [
          { taskNo: { $regex: q, $options: 'i' } },
          { designName: { $regex: q, $options: 'i' } },
          { designerName: { $regex: q, $options: 'i' } },
          { fabricName: { $regex: q, $options: 'i' } },
          { colourMatching: { $regex: q, $options: 'i' } },
          { drowDesignStatus: { $regex: q, $options: 'i' } },
          { colourMatchingStatus: { $regex: q, $options: 'i' } },
          { finalDesignStatus: { $regex: q, $options: 'i' } },
          { notes: { $regex: q, $options: 'i' } },
        ],
      });
    }

    if (andConditions.length > 0) {
      filter.$and = andConditions;
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

    // Handle updates to workflow status images
    if (Array.isArray(body.newDrowImages) && body.newDrowImages.length > 0) {
      task.drowDesignImages = Array.from(new Set([...(task.drowDesignImages || []), ...body.newDrowImages]));
    }
    if (Array.isArray(body.newColourMatchingImages) && body.newColourMatchingImages.length > 0) {
      task.colourMatchingImages = Array.from(new Set([...(task.colourMatchingImages || []), ...body.newColourMatchingImages]));
    }
    if (Array.isArray(body.newFinalDesignImages) && body.newFinalDesignImages.length > 0) {
      task.finalDesignImages = Array.from(new Set([...(task.finalDesignImages || []), ...body.newFinalDesignImages]));
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
 * Update task stage or specific workflow status with multi-image support
 */
const updateTaskStage = async (req, res) => {
  try {
    const { id } = req.params;
    const {
      stage,
      statusValue,
      category = 'general', // 'drow_design' | 'colour_matching' | 'final_design' | 'general'
      statusType = '',      // 'DROW DESIGN STATUS' | 'COLOUR MATCHING STATUS' | 'FINAL DESIGN STATUS'
      images = [],          // Array of Cloudflare R2 image URLs
      note = '',
      outputImage = '',
      outputLink = '',
    } = req.body;

    const targetStage = (statusValue || stage || '').trim();
    if (!targetStage && (!images || images.length === 0)) {
      return res.status(400).json({ error: 'Stage, status value, or image upload is required' });
    }

    let task = await db.DesignerTask.findById(id);
    if (!task) {
      task = await db.DesignerTask.findOne({ taskNo: id });
    }
    if (!task) {
      return res.status(404).json({ error: 'Designer task not found' });
    }

    const editorName = req.user?.name || req.headers['x-user-name'] || 'Designer';
    const editorId = req.user?._id || req.headers['x-user-id'] || '';

    // Collect array of incoming R2 images
    const incomingImages = Array.isArray(images)
      ? images.filter(Boolean)
      : (outputImage ? [outputImage] : []);

    let detectedCategory = category;
    let detectedStatusType = statusType;

    // Detect category if not explicitly given
    if (!detectedCategory || detectedCategory === 'general') {
      if (['START WORKING', 'REVIEW SAMPLE', 'FINAL SAMPLE'].includes(targetStage)) {
        detectedCategory = 'drow_design';
        detectedStatusType = 'DROW DESIGN STATUS';
      } else if (targetStage === 'COLOUR PANTON') {
        detectedCategory = 'colour_matching';
        detectedStatusType = 'COLOUR MATCHING STATUS';
      } else if (['REJECT SAMPLE drowning', 'REJECT SAMPLE FOR C.M.', 'APPROVED SAMPLE'].includes(targetStage)) {
        detectedCategory = 'final_design';
        detectedStatusType = 'FINAL DESIGN STATUS';
      }
    }

    // 1. Drow Design Status
    if (detectedCategory === 'drow_design' || detectedStatusType.toUpperCase().includes('DROW')) {
      if (targetStage) task.drowDesignStatus = targetStage;
      if (incomingImages.length > 0) {
        task.drowDesignImages = Array.from(new Set([...(task.drowDesignImages || []), ...incomingImages]));
      }
      if (task.status === 'New' || task.status === 'Assigned') {
        task.status = 'In Progress';
      }
    }

    // 2. Colour Matching Status
    if (detectedCategory === 'colour_matching' || detectedStatusType.toUpperCase().includes('COLOUR')) {
      if (targetStage) task.colourMatchingStatus = targetStage;
      if (incomingImages.length > 0) {
        task.colourMatchingImages = Array.from(new Set([...(task.colourMatchingImages || []), ...incomingImages]));
      }
      if (task.status !== 'Approved') {
        task.status = 'Colour Matching';
      }
    }

    // 3. Final Design Status
    if (detectedCategory === 'final_design' || detectedStatusType.toUpperCase().includes('FINAL')) {
      if (targetStage) task.finalDesignStatus = targetStage;
      if (incomingImages.length > 0) {
        task.finalDesignImages = Array.from(new Set([...(task.finalDesignImages || []), ...incomingImages]));
      }
      if (targetStage === 'APPROVED SAMPLE') {
        task.status = 'Approved';
      } else if (targetStage.startsWith('REJECT')) {
        task.status = 'Revision Requested';
      }
    }

    // Always update overall output image/link if new images provided
    if (incomingImages.length > 0) {
      task.outputImage = incomingImages[0];
    } else if (outputImage) {
      task.outputImage = outputImage;
    }
    if (outputLink) task.outputLink = outputLink;

    // Add to complete stage audit trail
    task.stageHistory.push({
      category: detectedCategory || 'general',
      statusType: detectedStatusType || '',
      stage: targetStage || 'Image Update',
      images: incomingImages,
      outputImage: incomingImages[0] || outputImage || task.outputImage || '',
      outputLink: outputLink || task.outputLink || '',
      note: note || (targetStage ? `Status updated to "${targetStage}"` : `Uploaded ${incomingImages.length} image(s)`),
      updatedBy: String(editorId),
      updatedByName: editorName,
      updatedAt: new Date(),
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
    const { assignedUser, assignedName, designerName } = req.query;
    const matchStage = {};
    const activeAssigned = (assignedUser || assignedName || '').trim();

    if (activeAssigned === '__NO_NAME_ASSIGNED__') {
      return res.status(200).json({
        success: true,
        data: {
          total: 0, new: 0, assigned: 0, inProgress: 0, colourMatching: 0, sampleReady: 0, revision: 0, approved: 0, cancelled: 0,
          drowStatus: {}, colourMatchingStatus: {}, finalDesignStatus: {}
        }
      });
    }

    if (activeAssigned && activeAssigned !== 'All') {
      const esc = activeAssigned.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const reg = new RegExp(esc, 'i');
      matchStage.$or = [
        { designerName: { $regex: reg } },
        { designers: { $in: [new RegExp(`^${esc}$`, 'i'), reg] } },
        { designers: activeAssigned },
        { colourMatching: { $regex: reg } },
        { colourMatches: { $in: [new RegExp(`^${esc}$`, 'i'), reg] } },
        { colourMatches: activeAssigned },
      ];
    } else if (designerName && designerName.trim() && designerName !== 'All') {
      const esc = designerName.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const reg = new RegExp(esc, 'i');
      matchStage.$or = [
        { designerName: { $regex: reg } },
        { designers: { $in: [new RegExp(`^${esc}$`, 'i'), reg] } },
        { designers: designerName.trim() },
      ];
    }

    const pipeline = Object.keys(matchStage).length > 0 ? [{ $match: matchStage }] : [];

    const [statusStats, priorityStats, drowStats, cmStats, finalStats, totalCount] = await Promise.all([
      db.DesignerTask.aggregate([
        ...pipeline,
        { $group: { _id: '$status', count: { $sum: 1 } } },
      ]),
      db.DesignerTask.aggregate([
        ...pipeline,
        { $group: { _id: '$priority', count: { $sum: 1 } } },
      ]),
      db.DesignerTask.aggregate([
        ...pipeline,
        { $group: { _id: '$drowDesignStatus', count: { $sum: 1 } } },
      ]),
      db.DesignerTask.aggregate([
        ...pipeline,
        { $group: { _id: '$colourMatchingStatus', count: { $sum: 1 } } },
      ]),
      db.DesignerTask.aggregate([
        ...pipeline,
        { $group: { _id: '$finalDesignStatus', count: { $sum: 1 } } },
      ]),
      db.DesignerTask.countDocuments(matchStage),
    ]);

    const statusMap = {};
    statusStats.forEach(s => { statusMap[s._id] = s.count; });

    const priorityMap = {};
    priorityStats.forEach(p => { priorityMap[p._id] = p.count; });

    const drowMap = {};
    drowStats.forEach(d => { if (d._id) drowMap[d._id] = d.count; });

    const cmMap = {};
    cmStats.forEach(c => { if (c._id) cmMap[c._id] = c.count; });

    const finalMap = {};
    finalStats.forEach(f => { if (f._id) finalMap[f._id] = f.count; });

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
        // Drow Design status counts
        drow: {
          startWorking: drowMap['START WORKING'] || 0,
          reviewSample: drowMap['REVIEW SAMPLE'] || 0,
          finalSample: drowMap['FINAL SAMPLE'] || 0,
        },
        // Colour Matching status counts
        cm: {
          colourPanton: cmMap['COLOUR PANTON'] || 0,
          reviewSample: cmMap['REVIEW SAMPLE'] || 0,
          finalSample: cmMap['FINAL SAMPLE'] || 0,
        },
        // Final Design status counts
        final: {
          finalSample: finalMap['FINAL SAMPLE'] || 0,
          rejectDrow: finalMap['REJECT SAMPLE drowning'] || 0,
          rejectCM: finalMap['REJECT SAMPLE FOR C.M.'] || 0,
          approvedSample: finalMap['APPROVED SAMPLE'] || 0,
        },
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
