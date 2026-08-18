const db = require('../db/models');
const logger = require('../config/logger');

// Helper to build robust MongoDB filter for complaints
function buildComplaintFilter(params = {}) {
  const {
    search = '',
    status = 'All',
    priority = 'All',
    category = 'All',
    assignedTo = '',
    responsiblePerson = '',
    dateStart = '',
    dateEnd = '',
    companyEntity
  } = params;

  const andConditions = [];

  if (companyEntity) {
    const cleanCo = String(companyEntity).trim();
    if (cleanCo === 'Elite Digital Print') {
      andConditions.push({
        $or: [
          { companyEntity: 'Elite Digital Print' },
          { companyEntity: { $exists: false } },
          { companyEntity: null },
          { companyEntity: '' }
        ]
      });
    } else {
      andConditions.push({ companyEntity: cleanCo });
    }
  }

  if (assignedTo && assignedTo !== 'All') {
    const cleanUser = assignedTo.trim().replace(/[-/\\^$*+?.()|[\]{}]/g, '\\$&');
    const userRegex = new RegExp(cleanUser, 'i');
    andConditions.push({
      $or: [
        { assignedTo: userRegex },
        { responsiblePerson: userRegex },
        { responsiblePersons: userRegex }
      ]
    });
  }

  if (responsiblePerson && responsiblePerson !== 'All') {
    const cleanResp = responsiblePerson.trim().replace(/[-/\\^$*+?.()|[\]{}]/g, '\\$&');
    const rRegex = new RegExp(cleanResp, 'i');
    andConditions.push({
      $or: [
        { responsiblePerson: rRegex },
        { responsiblePersons: rRegex }
      ]
    });
  }

  if (status && status !== 'All') {
    andConditions.push({ status });
  }
  if (priority && priority !== 'All') {
    andConditions.push({ priority });
  }
  if (category && category !== 'All') {
    andConditions.push({ category });
  }

  if (dateStart || dateEnd) {
    const dsStr = dateStart ? String(dateStart).split('T')[0] : '';
    const deStr = dateEnd ? String(dateEnd).split('T')[0] : '';
    const minMs = dsStr ? Math.min(new Date(`${dsStr}T00:00:00.000Z`).getTime(), new Date(`${dsStr}T00:00:00.000`).getTime()) : null;
    const maxMs = deStr ? Math.max(new Date(`${deStr}T23:59:59.999Z`).getTime(), new Date(`${deStr}T23:59:59.999`).getTime()) : null;

    const dateQuery = {};
    if (minMs) dateQuery.$gte = new Date(minMs);
    if (maxMs) dateQuery.$lte = new Date(maxMs);

    const dateConditions = [];
    if (dsStr && deStr) {
      dateConditions.push({ date: { $gte: dsStr, $lte: deStr } });
    } else if (dsStr) {
      dateConditions.push({ date: { $gte: dsStr } });
    } else if (deStr) {
      dateConditions.push({ date: { $lte: deStr } });
    }

    if (minMs || maxMs) {
      dateConditions.push({ date: dateQuery });
      dateConditions.push({ createdAt: dateQuery });
    }

    if (dateConditions.length > 0) {
      andConditions.push({ $or: dateConditions });
    }
  }

  if (search && search.trim()) {
    const regex = new RegExp(search.trim().replace(/[-/\\^$*+?.()|[\]{}]/g, '\\$&'), 'i');
    andConditions.push({
      $or: [
        { complaintNo: regex },
        { partyName: regex },
        { jobCardNo: regex },
        { invoiceNo: regex },
        { designNo: regex },
        { description: regex },
        { actionTaken: regex },
        { category: regex },
        { subCategory: regex },
        { assignedTo: regex },
        { responsiblePerson: regex }
      ]
    });
  }

  return andConditions.length === 0
    ? {}
    : andConditions.length === 1
    ? andConditions[0]
    : { $and: andConditions };
}

// Get all complaints with filtering, search, pagination
const getAll = async (req, res) => {
  try {
    const { page = 1, limit = 100 } = req.query;
    const filter = buildComplaintFilter(req.query);

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

// Get Next Complaint Ticket Number (e.g. EE-COMP-1001, EF-COMP-1001)
const getNextNumber = async (req, res) => {
  try {
    const { companyEntity } = req.query;
    const filter = companyEntity ? { companyEntity } : {};
    const prefixMap = {
      'Elite Edition': 'EE-COMP-',
      'Elite Fabtex': 'EF-COMP-',
      'Elite Stitching': 'ES-COMP-',
      'Elite Online': 'EO-COMP-',
      'Elite Digital Print': 'EDP-COMP-'
    };
    const prefix = prefixMap[companyEntity] || 'COMP-';
    const complaints = await db.Complaint.find(filter, { complaintNo: 1 }).lean();
    let maxNo = 1000;

    complaints.forEach(c => {
      if (!c.complaintNo) return;
      const match = String(c.complaintNo).match(/COMP-(\d+)/i);
      if (match) {
        const num = parseInt(match[1], 10);
        if (!isNaN(num) && num > maxNo) maxNo = num;
      }
    });

    res.json({ nextComplaintNo: `${prefix}${maxNo + 1}` });
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

    if (Array.isArray(payload.responsiblePersons)) {
      payload.responsiblePerson = payload.responsiblePersons.join(', ');
    } else if (typeof payload.responsiblePerson === 'string' && payload.responsiblePerson.trim()) {
      payload.responsiblePersons = payload.responsiblePerson.split(',').map(s => s.trim()).filter(Boolean);
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

    const activeUserName = req.headers['x-user-name'] || req.user?.name || payload.userName || payload.createdBy || 'Staff User';
    payload.createdBy = activeUserName;
    payload.createdByName = activeUserName;

    const newComplaint = await db.Complaint.create(payload);

    // Publish Authority Activity Event
    try {
      const { publishActivity } = require('../utils/activityEvent');
      const uName = activeUserName;
      const uId = req.user?._id || payload.userId;
      publishActivity({
        actorId: uId,
        actorName: uName,
        action: 'CREATE',
        module: 'Digital Print Complaint',
        recordRef: newComplaint.complaintNo,
        recordId: newComplaint._id,
        permissionScope: 'complaints',
        department: 'Quality',
        description: `🚨 **New Complaint Ticket #${newComplaint.complaintNo}** logged for Party: **"${newComplaint.partyName}"** | Category: **${newComplaint.category || 'General'}** | Defective Mtr: **${newComplaint.defectiveMeters || 0}m** | Priority: **${newComplaint.priority || 'Normal'}** by **${uName}**.`
      }).catch(e => logger.warn('publishActivity complaint create failed: %s', e.message));
    } catch (e) {
      logger.warn('Failed to publish activity for complaint: %o', e);
    }

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

    const editorName = req.headers['x-user-name'] || req.user?.name || payload.userName || payload.updatedBy || 'Staff User';
    payload.updatedBy = editorName;
    payload.updatedByName = editorName;

    if (Array.isArray(payload.responsiblePersons)) {
      payload.responsiblePerson = payload.responsiblePersons.join(', ');
    } else if (typeof payload.responsiblePerson === 'string' && payload.responsiblePerson.trim()) {
      payload.responsiblePersons = payload.responsiblePerson.split(',').map(s => s.trim()).filter(Boolean);
    }

    if (payload.status === 'Close' && !payload.resolvedDate) {
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

// Add Comment to Complaint
const addComment = async (req, res) => {
  try {
    const { id } = req.params;
    const { text, userName } = req.body;

    if (!text || !text.trim()) {
      return res.status(400).json({ error: 'Comment text is required' });
    }

    const complaint = await db.Complaint.findById(id);
    if (!complaint) return res.status(404).json({ error: 'Complaint not found' });

    if (!complaint.comments) complaint.comments = [];
    complaint.comments.push({
      text: text.trim(),
      userName: (userName || 'System').trim(),
      createdAt: new Date()
    });

    await complaint.save();
    res.json(complaint);
  } catch (err) {
    logger.error('complaint.addComment error: %o', err);
    res.status(500).json({ error: err.message || 'Failed to add comment' });
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

// Clear All Complaints
const clearAll = async (req, res) => {
  try {
    const result = await db.Complaint.deleteMany({});
    res.json({
      success: true,
      message: `Cleared all ${result.deletedCount} complaint ticket records.`,
      deletedCount: result.deletedCount
    });
  } catch (err) {
    logger.error('complaint.clearAll error: %o', err);
    res.status(500).json({ error: 'Failed to clear complaints' });
  }
};

// Analytics Endpoint
const getAnalytics = async (req, res) => {
  try {
    const { dateStart = '', dateEnd = '' } = req.query;
    const filter = buildComplaintFilter(req.query);
    const jcFilter = {};

    if (dateStart || dateEnd) {
      jcFilter.createdAt = {};
      if (dateStart) jcFilter.createdAt.$gte = new Date(dateStart);
      if (dateEnd) jcFilter.createdAt.$lte = new Date(`${dateEnd}T23:59:59.999Z`);
    }

    const [total, open, hold, close, feedback, urgent, metrics, totalJobCards, closedTickets] = await Promise.all([
      db.Complaint.countDocuments(filter),
      db.Complaint.countDocuments({ ...filter, status: { $in: ['Open', 'Pending'] } }),
      db.Complaint.countDocuments({ ...filter, status: { $in: ['Hold', 'In Progress'] } }),
      db.Complaint.countDocuments({ ...filter, status: { $in: ['Close', 'Resolved'] } }),
      db.Complaint.countDocuments({ ...filter, status: 'Feedback' }),
      db.Complaint.countDocuments({ ...filter, priority: 'Urgent', status: { $nin: ['Close', 'Resolved'] } }),
      db.Complaint.aggregate([
        { $match: filter },
        { $group: { _id: null, totalDefectiveMeters: { $sum: '$defectiveMeters' }, totalExpectedAmount: { $sum: '$expectedAmount' } } }
      ]),
      db.JobCard ? db.JobCard.countDocuments(jcFilter).catch(() => 0) : 0,
      db.Complaint.find({ ...filter, status: { $in: ['Close', 'Resolved'] } }, { createdAt: 1, updatedAt: 1, date: 1, resolvedDate: 1 }).lean()
    ]);

    const totalDefectiveMeters = metrics.length > 0 ? metrics[0].totalDefectiveMeters : 0;
    const totalExpectedAmount = metrics.length > 0 ? (metrics[0].totalExpectedAmount || 0) : 0;

    // Complaint Rate % = (Total Complaints / Total Orders) * 100
    const totalOrdersCount = totalJobCards > 0 ? totalJobCards : (total > 0 ? total * 15 : 100);
    const complaintRate = totalOrdersCount > 0 ? ((total / totalOrdersCount) * 100).toFixed(2) : '0.00';

    // Resolution SLA / TAT calculation (Creation to Closure)
    let totalTatMs = 0;
    let validClosedCount = 0;
    closedTickets.forEach(t => {
      const start = t.createdAt ? new Date(t.createdAt).getTime() : (t.date ? new Date(t.date).getTime() : 0);
      const end = t.resolvedDate ? new Date(t.resolvedDate).getTime() : (t.updatedAt ? new Date(t.updatedAt).getTime() : 0);
      if (start > 0 && end > start) {
        totalTatMs += (end - start);
        validClosedCount++;
      }
    });

    let avgTatHours = 0;
    let avgTatFormatted = 'N/A';
    if (validClosedCount > 0) {
      const avgMs = totalTatMs / validClosedCount;
      avgTatHours = (avgMs / (1000 * 60 * 60)).toFixed(1);
      if (avgTatHours < 24) {
        avgTatFormatted = `${avgTatHours} hrs`;
      } else {
        avgTatFormatted = `${(avgTatHours / 24).toFixed(1)} days`;
      }
    }

    res.json({
      total,
      open,
      hold,
      close,
      feedback,
      urgent,
      totalDefectiveMeters,
      totalExpectedAmount,
      totalOrdersCount,
      complaintRate,
      avgTatHours,
      avgTatFormatted
    });
  } catch (err) {
    logger.error('complaint.getAnalytics error: %o', err);
    res.status(500).json({ error: 'Failed to fetch complaint analytics' });
  }
};

// Lookup order details across JobCards, FabricChallans, and Invoices with intelligent cross-linking
const lookupOrderDetails = async (req, res) => {
  try {
    const { query = '', jobCardNo: qJobCardNo = '', challanNo: qChallanNo = '', invoiceNo: qInvoiceNo = '' } = req.query;
    const rawSearch = (query || qJobCardNo || qChallanNo || qInvoiceNo || '').trim();

    if (!rawSearch) {
      return res.json({ success: false, message: 'No search term provided' });
    }

    // Extract numeric parts e.g. "JOB-2267" -> 2267, "EDP/26-27/267" -> 267
    const numMatch = rawSearch.match(/(\d+)/g);
    const numQueries = numMatch ? numMatch.map(n => parseInt(n, 10)).filter(n => !isNaN(n)) : [];

    const cleanTerm = rawSearch.replace(/[-/\\^$*+?.()|[\]{}]/g, '\\$&');
    const regex = new RegExp(cleanTerm, 'i');

    let jcDoc = null;
    let chDoc = null;
    let invDoc = null;
    let gjcDoc = null;

    // 1. Search JobCards
    if (db.JobCard) {
      jcDoc = await db.JobCard.findOne({
        $or: [
          { jobNo: regex },
          { jobCardNo: regex },
          { billNo: regex },
          { invoiceNo: regex },
          { challanNo: regex },
          { designNo: regex }
        ]
      }).lean();
    }

    // 2. Search BillingInvoices (Tax Invoices)
    if (db.BillingInvoice) {
      invDoc = await db.BillingInvoice.findOne({
        $or: [
          { invoiceNo: regex },
          { ourChallanNo: regex },
          { linkedChallanNos: regex },
          { 'items.jobNo': regex },
          { 'items.ourChallanNo': regex },
          { 'items.partyChallan': regex }
        ]
      }).lean();

      // If not found directly but jcDoc exists, query BillingInvoice using jcDoc fields
      if (!invDoc && jcDoc) {
        const jNo = jcDoc.jobNo || jcDoc.jobCardNo;
        const bNo = jcDoc.billNo;
        invDoc = await db.BillingInvoice.findOne({
          $or: [
            ...(bNo ? [{ invoiceNo: new RegExp(bNo.replace(/[-/\\^$*+?.()|[\]{}]/g, '\\$&'), 'i') }] : []),
            ...(jNo ? [{ 'items.jobNo': new RegExp(jNo.replace(/[-/\\^$*+?.()|[\]{}]/g, '\\$&'), 'i') }] : [])
          ]
        }).lean();
      }
    }

    // 3. Search FabricChallans
    if (db.FabricChallan) {
      const challanNumberFilter = [];
      if (numQueries.length > 0) {
        challanNumberFilter.push({ challanNo: { $in: numQueries } });
      }
      chDoc = await db.FabricChallan.findOne({
        $or: [
          { jobNo: regex },
          { vendorChallanNo: regex },
          { invoiceNo: regex },
          { designNo: regex },
          ...challanNumberFilter
        ]
      }).lean();

      // If not found directly but jcDoc or invDoc exist, find FabricChallan by their jobNo / invoiceNo
      if (!chDoc) {
        const targetJobNo = jcDoc?.jobNo || invDoc?.items?.find(i => i.jobNo)?.jobNo;
        const targetInvNo = invDoc?.invoiceNo || jcDoc?.billNo;
        if (targetJobNo || targetInvNo) {
          chDoc = await db.FabricChallan.findOne({
            $or: [
              ...(targetJobNo ? [{ jobNo: new RegExp(targetJobNo.replace(/[-/\\^$*+?.()|[\]{}]/g, '\\$&'), 'i') }] : []),
              ...(targetInvNo ? [{ invoiceNo: new RegExp(targetInvNo.replace(/[-/\\^$*+?.()|[\]{}]/g, '\\$&'), 'i') }] : [])
            ]
          }).lean();
        }
      }
    }

    // 4. Search GarmentJobCard
    if (!jcDoc && db.GarmentJobCard) {
      gjcDoc = await db.GarmentJobCard.findOne({
        $or: [{ jobCardNo: regex }, { challanNo: regex }]
      }).lean();
    }

    // Check if any matching order record was found
    if (!jcDoc && !invDoc && !chDoc && !gjcDoc) {
      return res.json({ success: false, message: 'No matching order found' });
    }

    // Merge details seamlessly across all linked documents
    const partyName =
      jcDoc?.party ||
      jcDoc?.billTo ||
      invDoc?.customer?.name ||
      invDoc?.customer?.businessName ||
      chDoc?.partyName ||
      chDoc?.billTo ||
      gjcDoc?.partyName ||
      '';

    const jobCardNo =
      jcDoc?.jobNo ||
      jcDoc?.jobCardNo ||
      invDoc?.items?.find(i => i.jobNo)?.jobNo ||
      chDoc?.jobNo ||
      gjcDoc?.jobCardNo ||
      '';

    let rawChallanNo =
      chDoc?.challanNo ||
      chDoc?.vendorChallanNo ||
      invDoc?.ourChallanNo ||
      invDoc?.linkedChallanNos?.[0] ||
      invDoc?.items?.find(i => i.ourChallanNo)?.ourChallanNo ||
      jcDoc?.challanNo ||
      gjcDoc?.challanNo ||
      '';

    if (rawChallanNo && typeof rawChallanNo === 'number') {
      rawChallanNo = `EDP-CH-${rawChallanNo}`;
    }

    const invoiceNo =
      invDoc?.invoiceNo ||
      jcDoc?.billNo ||
      chDoc?.invoiceNo ||
      '';

    const designNo =
      jcDoc?.designNo ||
      jcDoc?.designName ||
      chDoc?.designNo ||
      invDoc?.items?.find(i => i.itemName)?.itemName ||
      '';

    const totalMeters = parseFloat(
      jcDoc?.totalMtr ||
      jcDoc?.printMtr ||
      chDoc?.totalMtr ||
      invDoc?.items?.reduce((sum, item) => sum + (item.qty || 0), 0) ||
      0
    ) || 0;

    let foundInSources = [];
    if (jcDoc) foundInSources.push('Job Card');
    if (chDoc) foundInSources.push('Delivery Challan');
    if (invDoc) foundInSources.push('Invoice');
    if (gjcDoc) foundInSources.push('Garment Job Card');

    res.json({
      success: true,
      data: {
        partyName,
        jobCardNo,
        challanNo: rawChallanNo,
        invoiceNo,
        designNo,
        totalMeters,
        foundIn: foundInSources.join(' + ') || 'Database'
      }
    });
  } catch (err) {
    logger.error('complaint.lookupOrderDetails error: %o', err);
    res.status(500).json({ error: 'Failed to lookup order details' });
  }
};

module.exports = { getAll, getNextNumber, getOne, create, update, remove, clearAll, getAnalytics, lookupOrderDetails, addComment };
