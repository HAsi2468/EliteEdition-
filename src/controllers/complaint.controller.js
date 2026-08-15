const db = require('../db/models');
const logger = require('../config/logger');

// Get all complaints with filtering, search, pagination
const getAll = async (req, res) => {
  try {
    const {
      search = '',
      status = 'All',
      priority = 'All',
      category = 'All',
      dateStart = '',
      dateEnd = '',
      page = 1,
      limit = 100
    } = req.query;

    const filter = {};

    if (status && status !== 'All') {
      filter.status = status;
    }
    if (priority && priority !== 'All') {
      filter.priority = priority;
    }
    if (category && category !== 'All') {
      filter.category = category;
    }

    if (dateStart || dateEnd) {
      filter.date = {};
      if (dateStart) filter.date.$gte = dateStart;
      if (dateEnd) filter.date.$lte = dateEnd;
    }

    if (search && search.trim()) {
      const regex = new RegExp(search.trim(), 'i');
      filter.$or = [
        { complaintNo: regex },
        { partyName: regex },
        { jobCardNo: regex },
        { invoiceNo: regex },
        { designNo: regex },
        { description: regex },
        { actionTaken: regex },
        { category: regex },
        { subCategory: regex },
        { assignedTo: regex }
      ];
    }

    const pageNum = parseInt(page, 10) || 1;
    const limitNum = parseInt(limit, 10) || 100;
    const skip = (pageNum - 1) * limitNum;

    const [data, total] = await Promise.all([
      db.Complaint.find(filter)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limitNum)
        .lean(),
      db.Complaint.countDocuments(filter)
    ]);

    res.json({
      success: true,
      data,
      total,
      page: pageNum,
      pages: Math.ceil(total / limitNum) || 1
    });
  } catch (err) {
    logger.error('complaint.getAll error: %o', err);
    res.status(500).json({ error: err.message || 'Failed to fetch complaints' });
  }
};

// Get Next Complaint Ticket Number (e.g. EDP-COMP-1001)
const getNextNumber = async (req, res) => {
  try {
    const complaints = await db.Complaint.find({}, { complaintNo: 1 }).lean();
    let maxNo = 1000;

    complaints.forEach(c => {
      if (!c.complaintNo) return;
      const match = String(c.complaintNo).match(/(?:EDP-)?COMP-(\d+)/i);
      if (match) {
        const num = parseInt(match[1], 10);
        if (!isNaN(num) && num > maxNo) maxNo = num;
      }
    });

    res.json({ nextComplaintNo: `EDP-COMP-${maxNo + 1}` });
  } catch (err) {
    logger.error('complaint.getNextNumber error: %o', err);
    res.status(500).json({ error: 'Failed to generate next complaint number' });
  }
};

// Get Single Complaint
const getOne = async (req, res) => {
  try {
    const item = await db.Complaint.findById(req.params.id);
    if (!item) return res.status(404).json({ error: 'Complaint not found' });
    res.json(item);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch complaint details' });
  }
};

// Create New Complaint
const create = async (req, res) => {
  try {
    const payload = req.body;
    if (!payload.partyName) {
      return res.status(400).json({ error: 'Party Name is required' });
    }

    if (!payload.complaintNo) {
      const complaints = await db.Complaint.find({}, { complaintNo: 1 }).lean();
      let maxNo = 1000;
      complaints.forEach(c => {
        if (!c.complaintNo) return;
        const match = String(c.complaintNo).match(/(?:EDP-)?COMP-(\d+)/i);
        if (match) {
          const num = parseInt(match[1], 10);
          if (!isNaN(num) && num > maxNo) maxNo = num;
        }
      });
      payload.complaintNo = `EDP-COMP-${maxNo + 1}`;
    }

    const newComplaint = await db.Complaint.create(payload);

    // Broadcast High/Urgent Complaint Notification to [EDP] Billing & Invoicing chat group if applicable
    if (['High', 'Urgent'].includes(payload.priority)) {
      try {
        const room = await db.ChatRoom.findOne({ name: /\[EDP\]/i });
        if (room) {
          await db.ChatMessage.create({
            roomId: room._id,
            sender: 'System Alert',
            text: `🚨 High Priority Complaint Logged: ${newComplaint.complaintNo} (${newComplaint.partyName}) - ${newComplaint.category} [${newComplaint.defectiveMeters || 0} Meters Affected]`,
            type: 'text'
          });
        }
      } catch (e) {
        logger.warn('Failed to broadcast complaint to chat room: %o', e);
      }
    }

    res.status(201).json(newComplaint);
  } catch (err) {
    logger.error('complaint.create error: %o', err);
    res.status(500).json({ error: err.message || 'Failed to create complaint' });
  }
};

// Update Complaint
const update = async (req, res) => {
  try {
    const { id } = req.params;
    const payload = req.body;

    if (payload.status === 'Resolved' && !payload.resolvedDate) {
      payload.resolvedDate = new Date();
    }

    const updated = await db.Complaint.findByIdAndUpdate(id, payload, { new: true, runValidators: true });
    if (!updated) return res.status(404).json({ error: 'Complaint not found' });

    res.json(updated);
  } catch (err) {
    logger.error('complaint.update error: %o', err);
    res.status(500).json({ error: err.message || 'Failed to update complaint' });
  }
};

// Delete Complaint
const remove = async (req, res) => {
  try {
    const item = await db.Complaint.findByIdAndDelete(req.params.id);
    if (!item) return res.status(404).json({ error: 'Complaint not found' });
    res.json({ message: 'Complaint deleted successfully' });
  } catch (err) {
    res.status(500).json({ error: 'Failed to delete complaint' });
  }
};

// Analytics Endpoint
const getAnalytics = async (req, res) => {
  try {
    const [total, open, hold, close, feedback, urgent, metrics] = await Promise.all([
      db.Complaint.countDocuments({}),
      db.Complaint.countDocuments({ status: { $in: ['Open', 'Pending'] } }),
      db.Complaint.countDocuments({ status: { $in: ['Hold', 'In Progress'] } }),
      db.Complaint.countDocuments({ status: { $in: ['Close', 'Resolved'] } }),
      db.Complaint.countDocuments({ status: 'Feedback' }),
      db.Complaint.countDocuments({ priority: 'Urgent', status: { $nin: ['Close', 'Resolved'] } }),
      db.Complaint.aggregate([
        { $group: { _id: null, totalDefectiveMeters: { $sum: '$defectiveMeters' }, totalExpectedAmount: { $sum: '$expectedAmount' } } }
      ])
    ]);

    const totalDefectiveMeters = metrics.length > 0 ? metrics[0].totalDefectiveMeters : 0;
    const totalExpectedAmount = metrics.length > 0 ? (metrics[0].totalExpectedAmount || 0) : 0;

    res.json({
      total,
      open,
      hold,
      close,
      feedback,
      urgent,
      totalDefectiveMeters,
      totalExpectedAmount
    });
  } catch (err) {
    logger.error('complaint.getAnalytics error: %o', err);
    res.status(500).json({ error: 'Failed to fetch complaint analytics' });
  }
};

module.exports = { getAll, getNextNumber, getOne, create, update, remove, getAnalytics };
