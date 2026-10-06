const { ChangeApprovalRequest, ...models } = require('../db/models');
const logger = require('../config/logger');
const { getApprovalSettings, setApprovalSettings } = require('../middlewares/approvalInterceptor.middleware');

/**
 * List Approval Requests with filters & pagination
 */
const getApprovalRequests = async (req, res) => {
  try {
    const { status = 'PENDING', module: moduleFilter, search = '', page = 1, limit = 50 } = req.query;

    const query = {};

    if (status && status !== 'ALL') {
      query.status = status.toUpperCase();
    }

    if (moduleFilter && moduleFilter !== 'ALL' && moduleFilter !== 'All') {
      query.module = moduleFilter;
    }

    if (search && search.trim()) {
      const regex = new RegExp(search.trim(), 'i');
      query.$or = [
        { targetIdentifier: regex },
        { 'requestedBy.name': regex },
        { module: regex },
        { targetId: regex },
      ];
    }

    const pageNum = Math.max(1, parseInt(page, 10) || 1);
    const limitNum = Math.min(100, Math.max(1, parseInt(limit, 10) || 50));
    const skip = (pageNum - 1) * limitNum;

    const [items, totalCount, pendingCount] = await Promise.all([
      ChangeApprovalRequest.find(query)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limitNum)
        .lean(),
      ChangeApprovalRequest.countDocuments(query),
      ChangeApprovalRequest.countDocuments({ status: 'PENDING' }),
    ]);

    return res.status(200).json({
      success: true,
      data: items,
      meta: {
        total: totalCount,
        pending: pendingCount,
        page: pageNum,
        limit: limitNum,
        totalPages: Math.ceil(totalCount / limitNum) || 1,
      },
    });
  } catch (err) {
    logger.error('[ChangeApprovalController] getApprovalRequests error: %o', err);
    return res.status(500).json({ success: false, message: 'Failed to fetch approval requests', error: err.message });
  }
};

/**
 * Get summary stats for Admin dashboard
 */
const getApprovalStats = async (req, res) => {
  try {
    const [pending, approved, rejected, total] = await Promise.all([
      ChangeApprovalRequest.countDocuments({ status: 'PENDING' }),
      ChangeApprovalRequest.countDocuments({ status: 'APPROVED' }),
      ChangeApprovalRequest.countDocuments({ status: 'REJECTED' }),
      ChangeApprovalRequest.countDocuments({}),
    ]);

    return res.status(200).json({
      success: true,
      data: {
        pending,
        approved,
        rejected,
        total,
      },
    });
  } catch (err) {
    logger.error('[ChangeApprovalController] getApprovalStats error: %o', err);
    return res.status(500).json({ success: false, message: 'Failed to fetch stats', error: err.message });
  }
};

/**
 * Helper: Replay & Execute the approved change
 */
const executeApprovedAction = async (approval, adminUser) => {
  const port = process.env.PORT || 3001;
  const url = `http://127.0.0.1:${port}${approval.targetEndpoint}`;

  // 1. Primary execution: Replay original HTTP request to API with Admin privileges
  try {
    const fetchOptions = {
      method: approval.httpMethod,
      headers: {
        'Content-Type': 'application/json',
        'X-Approval-Execution': 'true',
        'X-User-Id': String(adminUser?._id || adminUser?.id || 'admin'),
        'X-User-Name': adminUser?.name || 'Admin',
        'X-User-Role': 'admin',
        'X-Is-Admin': 'true',
        'X-Operator-Override': 'true',
        // Pass the admin's auth details so auth middleware recognizes the request
        'X-Internal-Service': 'approval-executor',
      },
    };

    if (!['GET', 'HEAD', 'DELETE'].includes(approval.httpMethod)) {
      fetchOptions.body = JSON.stringify(approval.requestBody || {});
    }

    const response = await fetch(url, fetchOptions);
    const contentType = response.headers.get('content-type') || '';

    let resBody = null;
    if (contentType.includes('application/json')) {
      resBody = await response.json();
    } else {
      resBody = await response.text();
    }

    if (response.ok) {
      return { success: true, method: 'API_REPLAY', data: resBody };
    }

    logger.warn('[ChangeApprovalController] API replay returned %d: %j', response.status, resBody);
  } catch (netErr) {
    logger.warn('[ChangeApprovalController] API replay fetch failed, attempting model fallback: %s', netErr.message);
  }

  // 2. Fail-safe Fallback: Direct Mongoose Model update / delete
  try {
    let targetModel = models[approval.module];
    if (!targetModel && (approval.module === 'Fabric' || approval.module === 'FabricTransaction')) {
      targetModel = models.FabricTransaction || models.Fabric;
    }
    if (targetModel && approval.targetId) {
      if (approval.httpMethod === 'DELETE') {
        const deleted = await targetModel.findByIdAndDelete(approval.targetId);
        return { success: true, method: 'DIRECT_MODEL_DELETE', data: deleted };
      } else {
        const payload = { ...approval.requestBody };

        // Special handling for tpDetails: sanitize before applying
        if (Array.isArray(payload.tpDetails)) {
          payload.tpDetails = payload.tpDetails
            .filter(r => r.tpMeter != null && r.tpMeter !== '')
            .map((r, idx) => ({
              tpNo: Number(r.tpNo) || idx + 1,
              tpMeter: parseFloat(r.tpMeter) || 0,
              notes: r.notes || '',
            }));
          if (payload.totalTp === undefined) {
            payload.totalTp = payload.tpDetails.filter(r => parseFloat(r.tpMeter) > 0).length;
          }
        }

        const updated = await targetModel.findByIdAndUpdate(
          approval.targetId,
          { $set: payload },
          { new: true, runValidators: false }
        );

        // Broadcast real-time module-specific socket event so screens update immediately
        try {
          const io = global.io;
          if (io && updated) {
            if (approval.module === 'Fabric' || approval.module === 'FabricTransaction') {
              io.emit('fabric-updated', { type: 'transaction-updated', data: updated });
            } else if (approval.module === 'JobCard') {
              io.emit('jobCardUpdated', updated);
            }
          }
        } catch (sockErr) {
          logger.warn('[ChangeApprovalController] Real-time fallback broadcast failed: %s', sockErr.message);
        }

        return { success: true, method: 'DIRECT_MODEL_UPDATE', data: updated };
      }
    }
  } catch (modelErr) {
    logger.error('[ChangeApprovalController] Direct model fallback failed: %o', modelErr);
    throw new Error(`Failed to apply changes: ${modelErr.message}`);
  }

  return { success: true, method: 'ACKNOWLEDGED' };
};

/**
 * Approve a pending change request and execute it
 */
const approveRequest = async (req, res) => {
  try {
    const { id } = req.params;
    const { notes = '' } = req.body;

    const approval = await ChangeApprovalRequest.findById(id);
    if (!approval) {
      return res.status(404).json({ success: false, message: 'Approval request not found' });
    }

    if (approval.status !== 'PENDING') {
      return res.status(400).json({
        success: false,
        message: `This request is already marked as ${approval.status}`,
      });
    }

    // Execute the approved changes
    const executionResult = await executeApprovedAction(approval, req.user);

    approval.status = 'APPROVED';
    approval.reviewedBy = {
      userId: String(req.user?._id || req.user?.id || 'admin'),
      name: req.user?.name || req.user?.username || 'Admin',
      email: req.user?.email || '',
    };
    approval.reviewedAt = new Date();
    approval.adminNotes = notes || 'Approved by Admin';
    approval.executionResult = executionResult;

    await approval.save();

    // Broadcast real-time status update to all connected clients
    try {
      const io = global.io || (req.app && req.app.get('io'));
      if (io) {
        io.emit('approval-status-changed', {
          id: approval._id,
          status: 'APPROVED',
          module: approval.module,
          targetIdentifier: approval.targetIdentifier,
        });
      }
    } catch (sockErr) {
      logger.warn('[ChangeApprovalController] Socket emit failed: %s', sockErr.message);
    }

    return res.status(200).json({
      success: true,
      message: 'Changes approved and successfully applied to the database.',
      data: approval,
    });
  } catch (err) {
    logger.error('[ChangeApprovalController] approveRequest error: %o', err);
    return res.status(500).json({ success: false, message: 'Failed to approve request', error: err.message });
  }
};

/**
 * Reject a pending change request
 */
const rejectRequest = async (req, res) => {
  try {
    const { id } = req.params;
    const { reason = '' } = req.body;

    const approval = await ChangeApprovalRequest.findById(id);
    if (!approval) {
      return res.status(404).json({ success: false, message: 'Approval request not found' });
    }

    if (approval.status !== 'PENDING') {
      return res.status(400).json({
        success: false,
        message: `This request is already marked as ${approval.status}`,
      });
    }

    approval.status = 'REJECTED';
    approval.rejectionReason = reason || 'Rejected by Administrator';
    approval.reviewedBy = {
      userId: String(req.user?._id || req.user?.id || 'admin'),
      name: req.user?.name || req.user?.username || 'Admin',
      email: req.user?.email || '',
    };
    approval.reviewedAt = new Date();

    await approval.save();

    // Broadcast real-time status update
    try {
      const io = global.io || (req.app && req.app.get('io'));
      if (io) {
        io.emit('approval-status-changed', {
          id: approval._id,
          status: 'REJECTED',
          module: approval.module,
          targetIdentifier: approval.targetIdentifier,
          reason: approval.rejectionReason,
        });
      }
    } catch (sockErr) {
      logger.warn('[ChangeApprovalController] Socket emit failed: %s', sockErr.message);
    }

    return res.status(200).json({
      success: true,
      message: 'Change request rejected.',
      data: approval,
    });
  } catch (err) {
    logger.error('[ChangeApprovalController] rejectRequest error: %o', err);
    return res.status(500).json({ success: false, message: 'Failed to reject request', error: err.message });
  }
};

/**
 * Bulk Approve multiple pending requests
 */
const bulkApprove = async (req, res) => {
  try {
    const { ids = [], notes = 'Bulk approved by Admin' } = req.body;
    if (!Array.isArray(ids) || ids.length === 0) {
      return res.status(400).json({ success: false, message: 'IDs array required' });
    }

    const pendingRequests = await ChangeApprovalRequest.find({
      _id: { $in: ids },
      status: 'PENDING',
    });

    const results = [];
    for (const reqItem of pendingRequests) {
      try {
        const execRes = await executeApprovedAction(reqItem, req.user);
        reqItem.status = 'APPROVED';
        reqItem.reviewedBy = {
          userId: String(req.user?._id || req.user?.id || 'admin'),
          name: req.user?.name || req.user?.username || 'Admin',
        };
        reqItem.reviewedAt = new Date();
        reqItem.adminNotes = notes;
        reqItem.executionResult = execRes;
        await reqItem.save();
        results.push({ id: reqItem._id, success: true });
      } catch (e) {
        results.push({ id: reqItem._id, success: false, error: e.message });
      }
    }

    return res.status(200).json({
      success: true,
      message: `Processed ${results.filter(r => r.success).length} approvals successfully.`,
      results,
    });
  } catch (err) {
    logger.error('[ChangeApprovalController] bulkApprove error: %o', err);
    return res.status(500).json({ success: false, message: 'Bulk approval failed', error: err.message });
  }
};

/**
 * Bulk Reject multiple requests
 */
const bulkReject = async (req, res) => {
  try {
    const { ids = [], reason = 'Bulk rejected by Admin' } = req.body;
    if (!Array.isArray(ids) || ids.length === 0) {
      return res.status(400).json({ success: false, message: 'IDs array required' });
    }

    const updateResult = await ChangeApprovalRequest.updateMany(
      { _id: { $in: ids }, status: 'PENDING' },
      {
        $set: {
          status: 'REJECTED',
          rejectionReason: reason,
          reviewedBy: {
            userId: String(req.user?._id || req.user?.id || 'admin'),
            name: req.user?.name || req.user?.username || 'Admin',
          },
          reviewedAt: new Date(),
        },
      }
    );

    return res.status(200).json({
      success: true,
      message: `Rejected ${updateResult.modifiedCount} requests.`,
    });
  } catch (err) {
    logger.error('[ChangeApprovalController] bulkReject error: %o', err);
    return res.status(500).json({ success: false, message: 'Bulk reject failed', error: err.message });
  }
};

/**
 * Get and Update Approval Settings (Master Toggle)
 */
const getSettings = (req, res) => {
  const settings = getApprovalSettings();
  return res.status(200).json({ success: true, data: settings });
};

const updateSettings = (req, res) => {
  const updated = setApprovalSettings(req.body);
  return res.status(200).json({ success: true, message: 'Approval settings updated', data: updated });
};

/**
 * Review Screen: Fetch all data entries across the ERP created by users
 */
const getUserDataEntries = async (req, res) => {
  try {
    const {
      user = 'ALL',
      module: moduleFilter = 'ALL',
      company: companyFilter = 'ALL',
      department: departmentFilter = 'ALL',
      startDate = '',
      endDate = '',
      search = '',
      page = 1,
      limit = 40
    } = req.query;

    const pageNum = Math.max(1, parseInt(page, 10) || 1);
    const limitNum = Math.min(100, Math.max(1, parseInt(limit, 10) || 40));

    // Construct Date Range Objects & Strings
    let dateStartObj = null;
    let dateEndObj = null;
    let startDateStr = '';
    let endDateStr = '';

    if (startDate) {
      dateStartObj = new Date(startDate);
      startDateStr = startDate.split('T')[0];
    }
    if (endDate) {
      dateEndObj = new Date(endDate);
      dateEndObj.setHours(23, 59, 59, 999);
      endDateStr = endDate.split('T')[0];
    }
    const hasDate = Boolean(dateStartObj || dateEndObj);

    // Escape special regex chars
    const escapeRegex = (str) => str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

    // Normalize company name (e.g. handle 'Elite Digital Prints' vs 'Elite Digital Print')
    const normalizeCompany = (c) => (c || '').replace(/Prints$/i, 'Print').trim();

    // Construct User Filter matching actual staff name and known code variants
    let userRegex = null;
    if (user && user !== 'ALL' && user !== 'All') {
      const trimmed = user.trim();
      const aliases = {
        'Harshit Sidapara (HASI)': ['Harshit Sidapara (HASI)', 'Harshit Sidapara', 'HASI', 'Harshit'],
        'Dev Patel': ['Dev Patel', 'DEV'],
        'Rushabh Patel': ['Rushabh Patel', 'RUSHABH', 'Rushabh'],
        'Raj Dave': ['Raj Dave', 'RAJ'],
        'Jay Patel': ['Jay Patel', 'JAY'],
        'Ram Patel': ['Ram Patel', 'RAM'],
        'Devansu': ['Devansu', 'DEVANSU'],
      };
      const nameVariants = aliases[trimmed] || [trimmed];
      const pattern = nameVariants.map(escapeRegex).join('|');
      userRegex = new RegExp(`^(${pattern})$`, 'i');
    }

    // Construct Search Regex
    const searchRegex = (search && search.trim())
      ? new RegExp(search.trim(), 'i')
      : null;

    // Filter helper to determine if a module should be queried
    const shouldFetch = (modName, defaultCompany, defaultDept) => {
      if (moduleFilter !== 'ALL' && moduleFilter !== 'All' && moduleFilter !== modName) {
        return false;
      }
      if (companyFilter && companyFilter !== 'ALL' && companyFilter !== 'All') {
        const normFilter = normalizeCompany(companyFilter).toLowerCase();
        const normComp = normalizeCompany(defaultCompany).toLowerCase();
        // If default company doesn't match and module doesn't hold multi-company records, skip
        if (normComp !== normFilter && !['BillingInvoice', 'Expense', 'BillingCustomer'].includes(modName)) {
          return false;
        }
      }
      if (departmentFilter && departmentFilter !== 'ALL' && departmentFilter !== 'All') {
        if (defaultDept.toLowerCase() !== departmentFilter.toLowerCase()) {
          return false;
        }
      }
      return true;
    };

    // Resolve any matching User ObjectIds for populated references
    let matchedUserIds = [];
    if (userRegex && models.user) {
      try {
        const matched = await models.user.find({ name: userRegex }, '_id').lean();
        matchedUserIds = matched.map(u => u._id);
      } catch (e) {}
    }

    const promises = [];
    const maxFetch = limitNum * pageNum + 80;

    // 1. Job Cards (Digital Printing)
    if (shouldFetch('JobCard', 'Elite Digital Print', 'Digital Printing') && models.JobCard) {
      const q = {};
      if (hasDate) {
        const dateCond = {};
        if (dateStartObj) dateCond.$gte = dateStartObj;
        if (dateEndObj) dateCond.$lte = dateEndObj;

        const strCond = {};
        if (startDateStr) strCond.$gte = startDateStr;
        if (endDateStr) strCond.$lte = endDateStr;

        q.$or = [
          { created_date_time: dateCond },
          { date: strCond },
          { createdAt: dateCond },
        ];
      }
      if (userRegex) {
        const userOr = [
          { createdByName: userRegex },
          { createdBy: userRegex },
          { updatedByName: userRegex },
          { updatedBy: userRegex },
          { 'auditTrail.performedByName': userRegex },
          { 'auditTrail.performedBy': userRegex },
          { fusingOperator: userRegex },
          { printOperator: userRegex },
          { designer: userRegex },
        ];
        q.$and = q.$and ? [...q.$and, { $or: userOr }] : (q.$or ? [{ $or: q.$or }, { $or: userOr }] : [{ $or: userOr }]);
        delete q.$or;
      }
      if (searchRegex) {
        const searchOr = [
          { jobNo: searchRegex },
          { party: searchRegex },
          { partyName: searchRegex },
          { clientName: searchRegex },
          { fabric: searchRegex },
          { fabricName: searchRegex },
          { designNo: searchRegex },
          { designName: searchRegex },
        ];
        q.$and = q.$and ? [...q.$and, { $or: searchOr }] : [{ $or: searchOr }];
      }

      promises.push(
        models.JobCard.find(q)
          .sort({ created_date_time: -1, _id: -1 })
          .limit(maxFetch)
          .lean()
          .then(docs => docs.map(doc => {
            const rawParty = doc.partyName || doc.party || doc.clientName || 'Internal';
            const rawFabric = doc.fabric || doc.fabricName || doc.fabricType || 'Fabric';
            const rawMtr = doc.totalMtr || doc.freshMtr || doc.fusingMtr || 0;
            const parsedDate = doc.created_date_time || (doc.date ? new Date(doc.date) : (doc.createdAt || new Date()));
            const lastAudit = Array.isArray(doc.auditTrail) && doc.auditTrail.length > 0
              ? doc.auditTrail[doc.auditTrail.length - 1]
              : null;
            const editorName = doc.updatedByName || doc.updatedBy || (lastAudit ? (lastAudit.performedByName || lastAudit.performedBy) : '');
            const editorDate = doc.modified_date_time || doc.updatedAt || (lastAudit ? lastAudit.timestamp : null);

            return {
              id: doc._id,
              module: 'JobCard',
              moduleLabel: 'Job Card',
              companyEntity: normalizeCompany(doc.companyEntity || 'Elite Digital Print'),
              department: 'Digital Printing',
              identifier: doc.jobNo || `#${String(doc._id).slice(-6)}`,
              party: rawParty,
              details: `${rawMtr} Mtr • ${rawFabric} • Design: ${doc.designNo || doc.designName || 'N/A'}${doc.fusingMtr ? ` • Fused: ${doc.fusingMtr}m` : ''}${doc.printMtr ? ` • Print: ${doc.printMtr}m` : ''}`,
              amountOrQuantity: `${rawMtr} Mtr`,
              status: doc.fusingStatus || doc.printStatus || doc.status || doc.productionStage || 'Production',
              createdBy: doc.createdByName || doc.createdBy || 'Staff User',
              createdAt: parsedDate,
              updatedBy: editorName,
              updatedByName: editorName,
              updatedAt: editorDate,
              auditTrail: doc.auditTrail || [],
              rawDoc: doc,
            };
          }))
      );
    }

    // 2. Projects & Tasks
    if (shouldFetch('Task', 'Elite Edition', 'Projects & Tasks') && models.Task) {
      const q = {};
      if (hasDate) {
        const dateCond = {};
        if (dateStartObj) dateCond.$gte = dateStartObj;
        if (dateEndObj) dateCond.$lte = dateEndObj;
        q.$or = [{ createdAt: dateCond }, { updatedAt: dateCond }, { dueDate: dateCond }];
      }
      if (userRegex) {
        const userOr = [
          { 'auditLogs.userName': userRegex },
          { 'comments.senderName': userRegex },
        ];
        if (matchedUserIds.length > 0) {
          userOr.push({ createdBy: { $in: matchedUserIds } });
          userOr.push({ assignees: { $in: matchedUserIds } });
        }
        q.$and = q.$and ? [...q.$and, { $or: userOr }] : (q.$or ? [{ $or: q.$or }, { $or: userOr }] : [{ $or: userOr }]);
        delete q.$or;
      }
      if (searchRegex) {
        const searchOr = [
          { title: searchRegex },
          { projectRef: searchRegex },
          { clientName: searchRegex },
          { department: searchRegex },
          { description: searchRegex },
        ];
        q.$and = q.$and ? [...q.$and, { $or: searchOr }] : [{ $or: searchOr }];
      }

      promises.push(
        models.Task.find(q)
          .populate('createdBy', 'name username')
          .populate('assignees', 'name username')
          .sort({ updatedAt: -1, createdAt: -1, _id: -1 })
          .limit(maxFetch)
          .lean()
          .then(docs => docs.map(doc => {
            const parsedDate = doc.createdAt || new Date();
            const lastAudit = Array.isArray(doc.auditLogs) && doc.auditLogs.length > 0
              ? doc.auditLogs[doc.auditLogs.length - 1]
              : null;
            const editorName = lastAudit?.userName || '';
            const editorDate = lastAudit?.timestamp || doc.updatedAt || null;
            const creatorName = doc.createdBy?.name || doc.createdBy?.username || 'Staff User';
            const projTitle = doc.projectRef ? `[${doc.projectRef}] ${doc.title}` : doc.title;
            const assigneeNames = Array.isArray(doc.assignees) ? doc.assignees.map(a => a.name || a.username).filter(Boolean).join(', ') : '';

            return {
              id: doc._id,
              module: 'Task',
              moduleLabel: 'Project / Task',
              companyEntity: normalizeCompany(doc.companyEntity || 'Elite Edition'),
              department: doc.department && doc.department !== 'General' ? doc.department : 'Projects & Tasks',
              identifier: projTitle,
              party: doc.clientName || doc.projectRef || 'General Project',
              project: doc.projectRef || '',
              details: `Dept: ${doc.department || 'General'} • Priority: ${doc.priority || 'medium'}${assigneeNames ? ` • Assigned: ${assigneeNames}` : ''}${doc.auditLogs?.length ? ` • ${doc.auditLogs.length} updates logged` : ''}`,
              amountOrQuantity: doc.estimatedHours ? `${doc.estimatedHours} hrs` : (doc.status || 'Active'),
              status: doc.status || 'To Do',
              createdBy: creatorName,
              createdAt: parsedDate,
              updatedBy: editorName,
              updatedByName: editorName,
              updatedAt: editorDate,
              auditTrail: (doc.auditLogs || []).map(al => ({
                performedByName: al.userName || 'Staff',
                action: 'UPDATE',
                details: `${al.fieldChanged}: '${al.oldValue || ''}' ➔ '${al.newValue || ''}'`,
                timestamp: al.timestamp
              })),
              rawDoc: doc,
            };
          }))
      );
    }

    // 3. Fabric Inward & Outward Transactions
    if (shouldFetch('FabricTransaction', 'Elite Digital Print', 'Fabric & Stock') && (models.FabricTransaction || models.Fabric) && !userRegex) {
      const targetModel = models.FabricTransaction || models.Fabric;
      const q = {};
      if (hasDate) {
        const dateCond = {};
        if (dateStartObj) dateCond.$gte = dateStartObj;
        if (dateEndObj) dateCond.$lte = dateEndObj;
        q.$or = [{ date: dateCond }, { createdAt: dateCond }];
      }
      if (companyFilter && companyFilter !== 'ALL' && companyFilter !== 'All') {
        q.companyEntity = new RegExp(`^${escapeRegex(companyFilter)}`, 'i');
      }
      if (searchRegex) {
        const searchOr = [
          { fabricQuality: searchRegex },
          { vendorName: searchRegex },
          { partyName: searchRegex },
          { billTo: searchRegex },
          { notes: searchRegex },
        ];
        const numVal = Number(search.trim());
        if (!isNaN(numVal) && numVal > 0) {
          searchOr.push({ lotNo: numVal });
        }
        q.$and = q.$and ? [...q.$and, { $or: searchOr }] : [{ $or: searchOr }];
      }

      promises.push(
        targetModel.find(q)
          .sort({ date: -1, createdAt: -1, _id: -1 })
          .limit(maxFetch)
          .lean()
          .then(docs => docs.map(doc => {
            const parsedDate = doc.date || doc.createdAt || new Date();
            const rawParty = doc.partyName || doc.vendorName || (doc.type === 'INWARD' ? 'Vendor Inward' : 'Party Outward');
            const rolls = doc.totalTp || (doc.tpDetails?.length || 0);
            return {
              id: doc._id,
              module: 'FabricTransaction',
              moduleLabel: `Fabric ${doc.type === 'INWARD' ? 'Inward' : 'Outward'}`,
              companyEntity: normalizeCompany(doc.companyEntity || 'Elite Digital Print'),
              department: 'Fabric & Stock',
              identifier: doc.type === 'INWARD' ? `Lot #${doc.lotNo || '—'}` : (doc.jobNo ? `Job #${doc.jobNo}` : `Outward Lot #${doc.lotNo || '—'}`),
              party: rawParty,
              details: `${doc.qty || 0} Mtr (${rolls} Rolls) • ${doc.fabricQuality || 'Fabric'}${doc.panna ? ` • Panna: ${doc.panna}` : ''}${doc.challanNo ? ` • Challan: ${doc.challanNo}` : ''}`,
              amountOrQuantity: `${doc.qty || 0} Mtr`,
              status: doc.type === 'INWARD' ? 'Stock Inward' : 'Stock Outward',
              createdBy: doc.companyEntity || 'Fabric Dept',
              createdAt: parsedDate,
              updatedBy: '',
              updatedByName: '',
              updatedAt: doc.updatedAt || null,
              rawDoc: doc,
            };
          }))
      );
    }

    // 4. Raw Material Transactions
    if (shouldFetch('RawMaterialTransaction', 'Elite Digital Print', 'Fabric & Stock') && models.RawMaterialTransaction) {
      const q = {};
      if (hasDate) {
        const dateCond = {};
        if (dateStartObj) dateCond.$gte = dateStartObj;
        if (dateEndObj) dateCond.$lte = dateEndObj;
        q.$or = [{ date: dateCond }, { createdAt: dateCond }];
      }
      if (companyFilter && companyFilter !== 'ALL' && companyFilter !== 'All') {
        q.companyEntity = new RegExp(`^${escapeRegex(companyFilter)}`, 'i');
      }
      if (userRegex) {
        const userOr = [
          { createdByName: userRegex },
          { createdBy: userRegex },
          { updatedByName: userRegex },
          { updatedBy: userRegex },
          { receivedBy: userRegex },
          { issuedTo: userRegex },
        ];
        q.$and = q.$and ? [...q.$and, { $or: userOr }] : [{ $or: userOr }];
      }
      if (searchRegex) {
        const searchOr = [
          { materialName: searchRegex },
          { vendorName: searchRegex },
          { receivedBy: searchRegex },
          { issuedTo: searchRegex },
          { challanNo: searchRegex },
          { jobNo: searchRegex },
          { purpose: searchRegex },
          { remarks: searchRegex },
        ];
        q.$and = q.$and ? [...q.$and, { $or: searchOr }] : [{ $or: searchOr }];
      }

      promises.push(
        models.RawMaterialTransaction.find(q)
          .sort({ date: -1, createdAt: -1, _id: -1 })
          .limit(maxFetch)
          .lean()
          .then(docs => docs.map(doc => {
            const parsedDate = doc.date || doc.createdAt || new Date();
            const partyStr = doc.type === 'INWARD' ? (doc.vendorName || 'Supplier Inward') : (doc.issuedTo || 'Internal Issue');
            const editorName = doc.updatedByName || doc.updatedBy || '';
            return {
              id: doc._id,
              module: 'RawMaterialTransaction',
              moduleLabel: `Raw Material (${doc.type || 'INWARD'})`,
              companyEntity: normalizeCompany(doc.companyEntity || 'Elite Digital Print'),
              department: 'Fabric & Stock',
              identifier: doc.type === 'INWARD'
                ? (doc.challanNo ? `Challan #${doc.challanNo}` : (doc.lotNo ? `Lot #${doc.lotNo}` : 'RM Inward'))
                : (doc.jobNo ? `Job #${doc.jobNo}` : 'RM Outward'),
              party: partyStr,
              details: `${doc.materialName} • ${doc.qty} ${doc.unit || 'Rolls'}${doc.purpose ? ` • ${doc.purpose}` : ''}${doc.remarks ? ` • ${doc.remarks}` : ''}`,
              amountOrQuantity: `${doc.qty} ${doc.unit || 'Rolls'}`,
              status: doc.type === 'INWARD' ? 'RM Inward' : 'RM Outward',
              createdBy: doc.createdByName || doc.createdBy || doc.receivedBy || 'Staff User',
              createdAt: parsedDate,
              updatedBy: editorName,
              updatedByName: editorName,
              updatedAt: doc.updatedAt || null,
              rawDoc: doc,
            };
          }))
      );
    }

    // 5. Catalog Designs
    if (shouldFetch('Design', 'Elite Digital Print', 'Design & Pre-Press') && models.Design) {
      const q = {};
      if (hasDate) {
        const dateCond = {};
        if (dateStartObj) dateCond.$gte = dateStartObj;
        if (dateEndObj) dateCond.$lte = dateEndObj;
        q.$or = [{ created_date_time: dateCond }, { createdAt: dateCond }];
      }
      if (userRegex) {
        const userOr = [{ designerName: userRegex }];
        q.$and = q.$and ? [...q.$and, { $or: userOr }] : (q.$or ? [{ $or: q.$or }, { $or: userOr }] : [{ $or: userOr }]);
        delete q.$or;
      }
      if (searchRegex) {
        const searchOr = [
          { designName: searchRegex },
          { designerName: searchRegex },
          { fabricName: searchRegex },
          { category: searchRegex },
          { parties: searchRegex },
        ];
        q.$and = q.$and ? [...q.$and, { $or: searchOr }] : [{ $or: searchOr }];
      }

      promises.push(
        models.Design.find(q)
          .sort({ created_date_time: -1, _id: -1 })
          .limit(maxFetch)
          .lean()
          .then(docs => docs.map(doc => {
            const parsedDate = doc.created_date_time || doc.createdAt || new Date();
            const partyStr = Array.isArray(doc.parties) && doc.parties.length ? doc.parties.join(', ') : 'Catalog';
            return {
              id: doc._id,
              module: 'Design',
              moduleLabel: 'Catalog Design',
              companyEntity: normalizeCompany(doc.companyEntity || 'Elite Digital Print'),
              department: 'Design & Pre-Press',
              identifier: doc.designName || 'Design',
              party: partyStr,
              details: `Category: ${doc.category || 'General'} • Fabric: ${doc.fabricName || '—'}${doc.colors ? ` • Colors: ${doc.colors}` : ''}${doc.panna ? ` • Panna: ${doc.panna}` : ''}`,
              amountOrQuantity: doc.category || 'Design',
              status: doc.status || 'Active',
              createdBy: doc.designerName || 'Design Team',
              createdAt: parsedDate,
              updatedBy: '',
              updatedByName: '',
              updatedAt: doc.modified_date_time || doc.updatedAt || null,
              rawDoc: doc,
            };
          }))
      );
    }

    // 6. Designer Tasks
    if (shouldFetch('DesignerTask', 'Elite Digital Print', 'Design & Pre-Press') && models.DesignerTask) {
      const q = {};
      if (hasDate) {
        const strCond = {};
        if (startDateStr) strCond.$gte = startDateStr;
        if (endDateStr) strCond.$lte = endDateStr;
        const dateCond = {};
        if (dateStartObj) dateCond.$gte = dateStartObj;
        if (dateEndObj) dateCond.$lte = dateEndObj;
        q.$or = [{ date: strCond }, { createdAt: dateCond }];
      }
      if (userRegex) {
        const userOr = [
          { designerName: userRegex },
          { createdByName: userRegex },
          { createdBy: userRegex },
          { updatedByName: userRegex },
          { updatedBy: userRegex },
        ];
        q.$and = q.$and ? [...q.$and, { $or: userOr }] : [{ $or: userOr }];
      }
      if (searchRegex) {
        const searchOr = [
          { taskNo: searchRegex },
          { designName: searchRegex },
          { clientName: searchRegex },
          { designerName: searchRegex },
          { category: searchRegex },
          { notes: searchRegex },
        ];
        q.$and = q.$and ? [...q.$and, { $or: searchOr }] : [{ $or: searchOr }];
      }

      promises.push(
        models.DesignerTask.find(q)
          .sort({ date: -1, createdAt: -1, _id: -1 })
          .limit(maxFetch)
          .lean()
          .then(docs => docs.map(doc => {
            const parsedDate = doc.date ? new Date(doc.date) : (doc.createdAt || new Date());
            const editorName = doc.updatedByName || doc.updatedBy || '';
            return {
              id: doc._id,
              module: 'DesignerTask',
              moduleLabel: 'Designer Task',
              companyEntity: normalizeCompany(doc.companyEntity || 'Elite Digital Print'),
              department: 'Design & Pre-Press',
              identifier: doc.taskNo ? `Task #${doc.taskNo}` : (doc.designName || 'Designer Task'),
              party: doc.clientName || 'In-House Pre-Press',
              details: `Designer: ${doc.designerName || 'Unassigned'} • Category: ${doc.category || 'General'} • Priority: ${doc.priority || 'Normal'}`,
              amountOrQuantity: doc.category || 'Design Task',
              status: doc.status || 'Pending',
              createdBy: doc.createdByName || doc.createdBy || doc.designerName || 'Design Team',
              createdAt: parsedDate,
              updatedBy: editorName,
              updatedByName: editorName,
              updatedAt: doc.updatedAt || null,
              rawDoc: doc,
            };
          }))
      );
    }

    // 7. Garment Job Cards
    if (shouldFetch('GarmentJobCard', 'Elite Stitching', 'Stitching & Garments') && models.GarmentJobCard) {
      const q = {};
      if (hasDate) {
        const dateCond = {};
        if (dateStartObj) dateCond.$gte = dateStartObj;
        if (dateEndObj) dateCond.$lte = dateEndObj;
        q.$or = [{ created_date_time: dateCond }, { createdAt: dateCond }, { targetDate: dateCond }];
      }
      if (userRegex) {
        const userOr = [
          { createdByName: userRegex },
          { createdBy: userRegex },
          { updatedByName: userRegex },
          { updatedBy: userRegex },
          { designer: userRegex },
        ];
        q.$and = q.$and ? [...q.$and, { $or: userOr }] : (q.$or ? [{ $or: q.$or }, { $or: userOr }] : [{ $or: userOr }]);
        delete q.$or;
      }
      if (searchRegex) {
        const searchOr = [
          { jobNo: searchRegex },
          { clientName: searchRegex },
          { partyName: searchRegex },
          { styleNo: searchRegex },
        ];
        q.$and = q.$and ? [...q.$and, { $or: searchOr }] : [{ $or: searchOr }];
      }

      promises.push(
        models.GarmentJobCard.find(q)
          .sort({ created_date_time: -1, _id: -1 })
          .limit(maxFetch)
          .lean()
          .then(docs => docs.map(doc => {
            const pcs = doc.totalPieces || doc.pieces || 0;
            const parsedDate = doc.created_date_time || doc.createdAt || new Date();
            const editorName = doc.updatedByName || doc.updatedBy || '';
            const editorDate = doc.modified_date_time || doc.updatedAt || null;
            return {
              id: doc._id,
              module: 'GarmentJobCard',
              moduleLabel: 'Garment Job Card',
              companyEntity: normalizeCompany(doc.companyEntity || 'Elite Stitching'),
              department: 'Stitching & Garments',
              identifier: doc.jobNo ? `Garment #${doc.jobNo}` : 'Garment Job',
              party: doc.clientName || doc.partyName || 'Client',
              details: `${pcs} Pcs • Style: ${doc.styleNo || 'N/A'} • Status: ${doc.status || 'Active'}`,
              amountOrQuantity: `${pcs} Pcs`,
              status: doc.status || 'Active',
              createdBy: doc.createdByName || doc.createdBy || 'Staff User',
              createdAt: parsedDate,
              updatedBy: editorName,
              updatedByName: editorName,
              updatedAt: editorDate,
              rawDoc: doc,
            };
          }))
      );
    }

    // 8. Billing Invoices
    if (shouldFetch('BillingInvoice', 'Elite Digital Print', 'Billing & Accounts') && models.BillingInvoice) {
      const q = {};
      if (hasDate) {
        const dateCond = {};
        if (dateStartObj) dateCond.$gte = dateStartObj;
        if (dateEndObj) dateCond.$lte = dateEndObj;
        q.$or = [
          { invoiceDate: dateCond },
          { created_at: dateCond },
          { createdAt: dateCond },
        ];
      }
      if (companyFilter && companyFilter !== 'ALL' && companyFilter !== 'All') {
        q.companyEntity = new RegExp(`^${escapeRegex(companyFilter)}`, 'i');
      }
      if (userRegex) {
        const userOr = [
          { createdByName: userRegex },
          { createdBy: userRegex },
          { updatedByName: userRegex },
          { updatedBy: userRegex },
          { uploadedByName: userRegex },
          { approvedByName: userRegex },
        ];
        q.$and = q.$and ? [...q.$and, { $or: userOr }] : (q.$or ? [{ $or: q.$or }, { $or: userOr }] : [{ $or: userOr }]);
        delete q.$or;
      }
      if (searchRegex) {
        const searchOr = [
          { invoiceNo: searchRegex },
          { 'customer.name': searchRegex },
          { 'customer.businessName': searchRegex },
          { customerName: searchRegex },
          { partyName: searchRegex },
        ];
        q.$and = q.$and ? [...q.$and, { $or: searchOr }] : [{ $or: searchOr }];
      }

      promises.push(
        models.BillingInvoice.find(q)
          .sort({ invoiceDate: -1, created_at: -1, _id: -1 })
          .limit(maxFetch)
          .lean()
          .then(docs => docs.map(doc => {
            const rawParty = doc.customer?.name || doc.customer?.businessName || doc.customerName || doc.partyName || 'Customer';
            const total = Number(doc.grandTotal || doc.totalAmount || 0);
            const paid = Number(doc.paidAmount || 0);
            const due = Number(doc.balanceDue || (total - paid));
            const parsedDate = doc.invoiceDate || doc.created_at || doc.createdAt || new Date();
            const editorName = doc.uploadedByName || doc.approvedByName || doc.updatedByName || doc.updatedBy || '';
            const editorDate = doc.approvedAt || doc.updated_at || doc.updatedAt || null;
            return {
              id: doc._id,
              module: 'BillingInvoice',
              moduleLabel: 'Tax Invoice',
              companyEntity: normalizeCompany(doc.companyEntity || 'Elite Digital Print'),
              department: 'Billing & Accounts',
              identifier: doc.invoiceNo || (doc.invoicePrefix ? `${doc.invoicePrefix}${doc.invoiceSeq}` : 'Invoice'),
              party: rawParty,
              details: `Total: ₹${total.toLocaleString('en-IN')} • Paid: ₹${paid.toLocaleString('en-IN')} • Due: ₹${due.toLocaleString('en-IN')} • ${doc.items?.length || 0} Items`,
              amountOrQuantity: `₹${total.toLocaleString('en-IN')}`,
              status: `${doc.paymentStatus || 'UNPAID'} (${doc.invoiceStatus || 'FINAL'})`,
              createdBy: doc.createdByName || doc.createdBy || 'Billing Team',
              createdAt: parsedDate,
              updatedBy: editorName,
              updatedByName: editorName,
              updatedAt: editorDate,
              rawDoc: doc,
            };
          }))
      );
    }

    // 9. Billing Purchases
    if (shouldFetch('BillingPurchase', 'Elite Digital Print', 'Billing & Accounts') && models.BillingPurchase && !userRegex) {
      const q = {};
      if (hasDate) {
        const dateCond = {};
        if (dateStartObj) dateCond.$gte = dateStartObj;
        if (dateEndObj) dateCond.$lte = dateEndObj;
        q.$or = [{ date: dateCond }, { createdAt: dateCond }];
      }
      if (companyFilter && companyFilter !== 'ALL' && companyFilter !== 'All') {
        q.companyEntity = new RegExp(`^${escapeRegex(companyFilter)}`, 'i');
      }
      if (searchRegex) {
        const searchOr = [
          { purchaseNo: searchRegex },
          { vendorName: searchRegex },
          { itemName: searchRegex },
          { notes: searchRegex },
        ];
        q.$and = q.$and ? [...q.$and, { $or: searchOr }] : [{ $or: searchOr }];
      }

      promises.push(
        models.BillingPurchase.find(q)
          .sort({ date: -1, createdAt: -1, _id: -1 })
          .limit(maxFetch)
          .lean()
          .then(docs => docs.map(doc => {
            const amt = Number(doc.totalAmount || 0);
            const parsedDate = doc.date || doc.createdAt || new Date();
            return {
              id: doc._id,
              module: 'BillingPurchase',
              moduleLabel: 'Purchase Bill',
              companyEntity: normalizeCompany(doc.companyEntity || 'Elite Digital Print'),
              department: 'Billing & Accounts',
              identifier: doc.purchaseNo ? `PO #${doc.purchaseNo}` : 'Purchase Bill',
              party: doc.vendorName || 'Vendor',
              details: `${doc.items?.length || 1} Items • Taxable: ₹${Number(doc.taxableAmount || 0).toLocaleString('en-IN')}${doc.notes ? ` • ${doc.notes}` : ''}`,
              amountOrQuantity: `₹${amt.toLocaleString('en-IN')}`,
              status: 'Purchase Bill',
              createdBy: 'Accounts / Purchase',
              createdAt: parsedDate,
              updatedBy: '',
              updatedByName: '',
              updatedAt: doc.updatedAt || null,
              rawDoc: doc,
            };
          }))
      );
    }

    // 10. Expenses
    if (shouldFetch('Expense', 'Elite Digital Print', 'Billing & Accounts') && models.Expense) {
      const q = {};
      if (hasDate) {
        const strCond = {};
        if (startDateStr) strCond.$gte = startDateStr;
        if (endDateStr) strCond.$lte = endDateStr;

        const dateCond = {};
        if (dateStartObj) dateCond.$gte = dateStartObj;
        if (dateEndObj) dateCond.$lte = dateEndObj;

        q.$or = [
          { date: strCond },
          { createdAt: dateCond },
        ];
      }
      if (companyFilter && companyFilter !== 'ALL' && companyFilter !== 'All') {
        q.companyEntity = new RegExp(`^${escapeRegex(companyFilter)}`, 'i');
      }
      if (userRegex) {
        const userOr = [
          { createdByName: userRegex },
          { createdBy: userRegex },
          { updatedByName: userRegex },
          { updatedBy: userRegex },
        ];
        q.$and = q.$and ? [...q.$and, { $or: userOr }] : (q.$or ? [{ $or: q.$or }, { $or: userOr }] : [{ $or: userOr }]);
        delete q.$or;
      }
      if (searchRegex) {
        const searchOr = [
          { voucherNo: searchRegex },
          { category: searchRegex },
          { title: searchRegex },
          { partyName: searchRegex },
          { vendorName: searchRegex },
          { paidToOrReceivedFrom: searchRegex },
          { description: searchRegex },
        ];
        q.$and = q.$and ? [...q.$and, { $or: searchOr }] : [{ $or: searchOr }];
      }

      promises.push(
        models.Expense.find(q)
          .sort({ date: -1, createdAt: -1, _id: -1 })
          .limit(maxFetch)
          .lean()
          .then(docs => docs.map(doc => {
            const rawParty = doc.paidToOrReceivedFrom || doc.partyName || doc.vendorName || doc.title || 'General';
            const amt = Number(doc.amount || 0);
            const parsedDate = doc.date ? new Date(doc.date) : (doc.createdAt || new Date());
            const editorName = doc.updatedByName || doc.updatedBy || '';
            const editorDate = doc.updatedAt || null;
            return {
              id: doc._id,
              module: 'Expense',
              moduleLabel: `Expense (${doc.type || 'OUT'})`,
              companyEntity: normalizeCompany(doc.companyEntity || 'Elite Digital Print'),
              department: 'Billing & Accounts',
              identifier: doc.voucherNo || doc.title || 'Expense',
              party: rawParty,
              details: `${doc.category || 'General'} • Mode: ${doc.paymentMode || 'Cash'} ${doc.description ? `• ${doc.description}` : ''}`,
              amountOrQuantity: `₹${amt.toLocaleString('en-IN')}`,
              status: doc.type === 'IN' ? 'Cash IN' : 'Cash OUT',
              createdBy: doc.createdByName || doc.createdBy || 'Staff User',
              createdAt: parsedDate,
              updatedBy: editorName,
              updatedByName: editorName,
              updatedAt: editorDate,
              rawDoc: doc,
            };
          }))
      );
    }

    // 11. Complaints & Quality Management
    if (shouldFetch('Complaint', 'Elite Digital Print', 'Quality & Complaints') && models.Complaint) {
      const q = {};
      if (hasDate) {
        const strCond = {};
        if (startDateStr) strCond.$gte = startDateStr;
        if (endDateStr) strCond.$lte = endDateStr;
        const dateCond = {};
        if (dateStartObj) dateCond.$gte = dateStartObj;
        if (dateEndObj) dateCond.$lte = dateEndObj;
        q.$or = [{ date: strCond }, { createdAt: dateCond }, { resolvedDate: dateCond }];
      }
      if (companyFilter && companyFilter !== 'ALL' && companyFilter !== 'All') {
        q.companyEntity = new RegExp(`^${escapeRegex(companyFilter)}`, 'i');
      }
      if (userRegex) {
        const userOr = [
          { createdByName: userRegex },
          { createdBy: userRegex },
          { updatedByName: userRegex },
          { updatedBy: userRegex },
          { assignedTo: userRegex },
          { responsiblePerson: userRegex },
        ];
        q.$and = q.$and ? [...q.$and, { $or: userOr }] : [{ $or: userOr }];
      }
      if (searchRegex) {
        const searchOr = [
          { complaintNo: searchRegex },
          { partyName: searchRegex },
          { jobCardNo: searchRegex },
          { invoiceNo: searchRegex },
          { category: searchRegex },
          { description: searchRegex },
        ];
        q.$and = q.$and ? [...q.$and, { $or: searchOr }] : [{ $or: searchOr }];
      }

      promises.push(
        models.Complaint.find(q)
          .sort({ createdAt: -1, _id: -1 })
          .limit(maxFetch)
          .lean()
          .then(docs => docs.map(doc => {
            const parsedDate = doc.createdAt || (doc.date ? new Date(doc.date) : new Date());
            const editorName = doc.updatedByName || doc.updatedBy || '';
            return {
              id: doc._id,
              module: 'Complaint',
              moduleLabel: 'Quality Complaint',
              companyEntity: normalizeCompany(doc.companyEntity || 'Elite Digital Print'),
              department: 'Quality & Complaints',
              identifier: doc.complaintNo ? `#${doc.complaintNo}` : 'Complaint',
              party: doc.partyName || 'Party',
              details: `${doc.category || 'Printing Defect'} • Defective: ${doc.defectiveMeters || 0}m • Priority: ${doc.priority || 'Medium'}${doc.jobCardNo ? ` • Job: #${doc.jobCardNo}` : ''}${doc.responsiblePerson ? ` • Resp: ${doc.responsiblePerson}` : ''}`,
              amountOrQuantity: doc.defectiveMeters ? `${doc.defectiveMeters} Mtr` : (doc.expectedAmount ? `₹${doc.expectedAmount}` : 'Complaint'),
              status: doc.status || 'Open',
              createdBy: doc.createdByName || doc.createdBy || 'Staff User',
              createdAt: parsedDate,
              updatedBy: editorName,
              updatedByName: editorName,
              updatedAt: doc.updatedAt || null,
              rawDoc: doc,
            };
          }))
      );
    }

    // 12. Fabric Challans
    if (shouldFetch('FabricChallan', 'Elite Digital Print', 'Fabric & Stock') && models.FabricChallan) {
      const q = {};
      if (hasDate) {
        const dateCond = {};
        if (dateStartObj) dateCond.$gte = dateStartObj;
        if (dateEndObj) dateCond.$lte = dateEndObj;
        q.$or = [{ date: dateCond }, { createdAt: dateCond }];
      }
      if (companyFilter && companyFilter !== 'ALL' && companyFilter !== 'All') {
        q.companyEntity = new RegExp(`^${escapeRegex(companyFilter)}`, 'i');
      }
      if (userRegex) {
        const userOr = [
          { createdByName: userRegex },
          { createdBy: userRegex },
          { updatedByName: userRegex },
          { updatedBy: userRegex },
          { deliveryBy: userRegex },
        ];
        q.$and = q.$and ? [...q.$and, { $or: userOr }] : (q.$or ? [{ $or: q.$or }, { $or: userOr }] : [{ $or: userOr }]);
        delete q.$or;
      }
      if (searchRegex) {
        const numVal = Number(search.trim());
        const searchOr = [
          { partyName: searchRegex },
          { fabricName: searchRegex },
          { lotNo: searchRegex },
          { vendorChallanNo: searchRegex },
        ];
        if (!isNaN(numVal) && numVal > 0) {
          searchOr.push({ challanNo: numVal });
        }
        q.$and = q.$and ? [...q.$and, { $or: searchOr }] : [{ $or: searchOr }];
      }

      promises.push(
        models.FabricChallan.find(q)
          .sort({ date: -1, createdAt: -1, _id: -1 })
          .limit(maxFetch)
          .lean()
          .then(docs => docs.map(doc => {
            const mtr = doc.totalMtr || doc.totalMeters || doc.freshMtr || 0;
            const rolls = doc.totalRolls || (doc.tpDetails?.length || 0);
            const parsedDate = doc.date || doc.createdAt || new Date();
            const editorName = doc.updatedByName || doc.updatedBy || '';
            const editorDate = doc.updatedAt || null;
            return {
              id: doc._id,
              module: 'FabricChallan',
              moduleLabel: 'Fabric Challan',
              companyEntity: normalizeCompany(doc.companyEntity || 'Elite Digital Print'),
              department: 'Fabric & Stock',
              identifier: doc.challanNo ? `Challan #${doc.challanNo}` : 'Fabric Challan',
              party: doc.partyName || 'Party',
              details: `${mtr} Mtr (${rolls} Rolls) • ${doc.fabricName || 'Fabric'} • Lot: ${doc.lotNo || 'N/A'}`,
              amountOrQuantity: `${mtr} Mtr`,
              status: doc.status || 'Active',
              createdBy: doc.createdByName || doc.createdBy || doc.deliveryBy || 'Staff User',
              createdAt: parsedDate,
              updatedBy: editorName,
              updatedByName: editorName,
              updatedAt: editorDate,
              rawDoc: doc,
            };
          }))
      );
    }

    // 13. Stitching Challans
    if (shouldFetch('StitchingChallan', 'Elite Stitching', 'Stitching & Garments') && models.StitchingChallan) {
      const q = {};
      if (hasDate) {
        const dateCond = {};
        if (dateStartObj) dateCond.$gte = dateStartObj;
        if (dateEndObj) dateCond.$lte = dateEndObj;
        q.$or = [{ created_date_time: dateCond }, { date: dateCond }, { createdAt: dateCond }];
      }
      if (userRegex) {
        const userOr = [
          { createdByName: userRegex },
          { createdBy: userRegex },
          { updatedByName: userRegex },
          { updatedBy: userRegex },
          { workerName: userRegex },
        ];
        q.$and = q.$and ? [...q.$and, { $or: userOr }] : (q.$or ? [{ $or: q.$or }, { $or: userOr }] : [{ $or: userOr }]);
        delete q.$or;
      }
      if (searchRegex) {
        const numVal = Number(search.trim());
        const searchOr = [
          { partyName: searchRegex },
          { workerName: searchRegex },
          { jobNo: searchRegex },
        ];
        if (!isNaN(numVal) && numVal > 0) {
          searchOr.push({ challanNo: numVal });
        }
        q.$and = q.$and ? [...q.$and, { $or: searchOr }] : [{ $or: searchOr }];
      }

      promises.push(
        models.StitchingChallan.find(q)
          .sort({ created_date_time: -1, date: -1, _id: -1 })
          .limit(maxFetch)
          .lean()
          .then(docs => docs.map(doc => {
            const pcs = doc.totalPieces || doc.pieces || 0;
            const parsedDate = doc.created_date_time || doc.date || doc.createdAt || new Date();
            const editorName = doc.updatedByName || doc.updatedBy || '';
            const editorDate = doc.updatedAt || null;
            return {
              id: doc._id,
              module: 'StitchingChallan',
              moduleLabel: 'Stitching Challan',
              companyEntity: normalizeCompany(doc.companyEntity || 'Elite Stitching'),
              department: 'Stitching & Garments',
              identifier: doc.challanNo ? `Stitching #${doc.challanNo}` : 'Stitching Challan',
              party: doc.partyName || doc.workerName || 'Worker',
              details: `${pcs} Pcs • Job #${doc.jobNo || 'N/A'} • Worker: ${doc.workerName || 'N/A'}`,
              amountOrQuantity: `${pcs} Pcs`,
              status: doc.status || 'Active',
              createdBy: doc.createdByName || doc.createdBy || doc.workerName || 'Staff User',
              createdAt: parsedDate,
              updatedBy: editorName,
              updatedByName: editorName,
              updatedAt: editorDate,
              rawDoc: doc,
            };
          }))
      );
    }

    // 14. Inventory Inward/Stock
    if (shouldFetch('Inventory', 'Elite Edition', 'Inventory & Warehouse') && models.Inventory) {
      const q = {};
      if (hasDate) {
        const dateCond = {};
        if (dateStartObj) dateCond.$gte = dateStartObj;
        if (dateEndObj) dateCond.$lte = dateEndObj;
        q.$or = [{ created_date_time: dateCond }, { createdAt: dateCond }];
      }
      if (userRegex) {
        const userOr = [
          { createdByName: userRegex },
          { createdBy: userRegex },
          { updatedByName: userRegex },
          { updatedBy: userRegex },
        ];
        q.$and = q.$and ? [...q.$and, { $or: userOr }] : (q.$or ? [{ $or: q.$or }, { $or: userOr }] : [{ $or: userOr }]);
        delete q.$or;
      }
      if (searchRegex) {
        const searchOr = [
          { productName: searchRegex },
          { itemName: searchRegex },
          { vendorName: searchRegex },
          { supplier: searchRegex },
          { category: searchRegex },
        ];
        q.$and = q.$and ? [...q.$and, { $or: searchOr }] : [{ $or: searchOr }];
      }

      promises.push(
        models.Inventory.find(q)
          .sort({ created_date_time: -1, _id: -1 })
          .limit(maxFetch)
          .lean()
          .then(docs => docs.map(doc => {
            const parsedDate = doc.created_date_time || doc.createdAt || new Date();
            const qty = doc.quantity || 0;
            const unit = doc.unit || 'Units';
            const editorName = doc.updatedByName || doc.updatedBy || '';
            const editorDate = doc.updatedAt || null;
            return {
              id: doc._id,
              module: 'Inventory',
              moduleLabel: 'Inventory Item',
              companyEntity: normalizeCompany(doc.companyEntity || 'Elite Edition'),
              department: 'Inventory & Warehouse',
              identifier: doc.productName || doc.itemName || 'Inventory Item',
              party: doc.vendorName || doc.supplier || 'Stock',
              details: `${qty} ${unit} • ${doc.category || doc.type || 'Stock'}${doc.sku ? ` • SKU: ${doc.sku}` : ''}`,
              amountOrQuantity: `${qty} ${unit}`,
              status: doc.type || doc.category || 'In Stock',
              createdBy: doc.createdByName || doc.createdBy || 'Staff User',
              createdAt: parsedDate,
              updatedBy: editorName,
              updatedByName: editorName,
              updatedAt: editorDate,
              rawDoc: doc,
            };
          }))
      );
    }

    // 15. Stock Out Dispatches
    if (shouldFetch('StockOut', 'Elite Edition', 'Inventory & Warehouse') && models.StockOut && !userRegex) {
      const q = {};
      if (hasDate) {
        const dateCond = {};
        if (dateStartObj) dateCond.$gte = dateStartObj;
        if (dateEndObj) dateCond.$lte = dateEndObj;
        q.$or = [{ created_date_time: dateCond }, { createdAt: dateCond }];
      }
      if (searchRegex) {
        const searchOr = [
          { skuCode: searchRegex },
          { party: searchRegex },
          { facility: searchRegex },
        ];
        q.$and = q.$and ? [...q.$and, { $or: searchOr }] : [{ $or: searchOr }];
      }

      promises.push(
        models.StockOut.find(q)
          .sort({ created_date_time: -1, _id: -1 })
          .limit(maxFetch)
          .lean()
          .then(docs => docs.map(doc => {
            const parsedDate = doc.created_date_time || doc.createdAt || new Date();
            return {
              id: doc._id,
              module: 'StockOut',
              moduleLabel: 'Stock Out Dispatch',
              companyEntity: normalizeCompany(doc.companyEntity || 'Elite Edition'),
              department: 'Inventory & Warehouse',
              identifier: doc.skuCode ? `SKU: ${doc.skuCode}` : 'Stock Out',
              party: doc.party || 'Customer / Dispatch',
              details: `Qty Out: ${doc.qtyOut || 1} • Facility: ${doc.facility || 'Warehouse'}`,
              amountOrQuantity: `${doc.qtyOut || 1} Units`,
              status: 'Dispatched',
              createdBy: doc.facility || 'Warehouse Staff',
              createdAt: parsedDate,
              updatedBy: '',
              updatedByName: '',
              updatedAt: doc.modified_date_time || doc.updatedAt || null,
              rawDoc: doc,
            };
          }))
      );
    }

    // 16. Sale Orders (Online)
    if (shouldFetch('SaleOrder', 'Elite Online', 'E-Commerce & Orders') && models.SaleOrder && !userRegex) {
      const q = {};
      if (hasDate) {
        const dateCond = {};
        if (dateStartObj) dateCond.$gte = dateStartObj;
        if (dateEndObj) dateCond.$lte = dateEndObj;
        q.$or = [{ createdAt: dateCond }, { orderDate: dateCond }];
      }
      if (searchRegex) {
        const searchOr = [
          { displayOrderCode: searchRegex },
          { saleOrderItemCode: searchRegex },
          { shippingAddressName: searchRegex },
          { billingAddressName: searchRegex },
          { itemSKUCode: searchRegex },
          { itemTypeName: searchRegex },
        ];
        q.$and = q.$and ? [...q.$and, { $or: searchOr }] : [{ $or: searchOr }];
      }

      promises.push(
        models.SaleOrder.find(q)
          .sort({ createdAt: -1, _id: -1 })
          .limit(maxFetch)
          .lean()
          .then(docs => docs.map(doc => {
            const parsedDate = doc.createdAt || (doc.orderDate ? new Date(doc.orderDate) : new Date());
            const cust = doc.shippingAddressName || doc.billingAddressName || 'Online Order';
            const price = doc.totalPrice ? `₹${Number(doc.totalPrice).toLocaleString('en-IN')}` : 'Order Item';
            return {
              id: doc._id,
              module: 'SaleOrder',
              moduleLabel: 'Sale Order',
              companyEntity: normalizeCompany(doc.companyEntity || 'Elite Online'),
              department: 'E-Commerce & Orders',
              identifier: doc.displayOrderCode || doc.saleOrderItemCode || 'Order',
              party: cust,
              details: `SKU: ${doc.itemSKUCode || '—'} • ${doc.itemTypeName || 'Garment'} • City: ${doc.shippingAddressCity || '—'}`,
              amountOrQuantity: price,
              status: doc.saleOrderItemStatus || doc.saleOrderStatus || 'Pending',
              createdBy: 'Marketplace / Web',
              createdAt: parsedDate,
              updatedBy: '',
              updatedByName: '',
              updatedAt: doc.updatedAt || null,
              rawDoc: doc,
            };
          }))
      );
    }

    const resultsArray = await Promise.all(promises);
    let allEntries = resultsArray.flat();

    // Post-filter by company if specified
    if (companyFilter && companyFilter !== 'ALL' && companyFilter !== 'All') {
      const normFilter = normalizeCompany(companyFilter).toLowerCase();
      allEntries = allEntries.filter(e => normalizeCompany(e.companyEntity).toLowerCase() === normFilter);
    }

    // Post-filter by department if specified
    if (departmentFilter && departmentFilter !== 'ALL' && departmentFilter !== 'All') {
      const normDept = departmentFilter.toLowerCase();
      allEntries = allEntries.filter(e => (e.department || '').toLowerCase() === normDept);
    }

    // Sort by createdAt descending
    allEntries.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

    const totalCount = allEntries.length;
    const startIndex = (pageNum - 1) * limitNum;
    const paginatedItems = allEntries.slice(startIndex, startIndex + limitNum);

    return res.status(200).json({
      success: true,
      data: paginatedItems,
      meta: {
        total: totalCount,
        page: pageNum,
        limit: limitNum,
        totalPages: Math.ceil(totalCount / limitNum) || 1,
      },
    });
  } catch (err) {
    logger.error('[ChangeApprovalController] getUserDataEntries error: %o', err);
    return res.status(500).json({ success: false, message: 'Failed to fetch user entries', error: err.message });
  }
};

/**
 * Get distinct user list who have created, updated, or audited data
 */
const getEntryUsersList = async (req, res) => {
  try {
    const userSet = new Set();
    const excluded = new Set([
      'eliteedition', 'eliteac', 'admin', 'system', 'operator', 'staff user',
      '3', '350', 'porter', 'self drive', 'dubeji', 'sankar ji', 'lukman'
    ]);

    // 1. Registered staff accounts from models.user
    if (models.user) {
      const activeUsers = await models.user.find({}, 'name role email').lean();
      activeUsers.forEach(u => {
        const name = (u.name || '').trim();
        if (name && !excluded.has(name.toLowerCase())) {
          userSet.add(name);
        }
      });
    }

    // 2. Recognized staff members who entered or edited ERP data
    const recognizedStaff = [
      'Ajay Bind',
      'Dev Patel',
      'Devansu',
      'Dhruv Patel',
      'Durgesh Yadav',
      'Harshil',
      'Harshit Sidapara (HASI)',
      'Jay Asodariya',
      'Jay Patel',
      'Kaushik Nakum',
      'Parth Asodariya',
      'Raj Dave',
      'Ram Patel',
      'Rohit',
      'Rushabh Patel'
    ];
    recognizedStaff.forEach(s => userSet.add(s));

    const sortedUsers = Array.from(userSet).filter(Boolean).sort((a, b) => a.localeCompare(b));

    return res.status(200).json({
      success: true,
      data: sortedUsers,
    });
  } catch (err) {
    logger.error('[ChangeApprovalController] getEntryUsersList error: %o', err);
    return res.status(500).json({ success: false, message: 'Failed to fetch user list', error: err.message });
  }
};


module.exports = {
  getApprovalRequests,
  getApprovalStats,
  approveRequest,
  rejectRequest,
  bulkApprove,
  bulkReject,
  getSettings,
  updateSettings,
  getUserDataEntries,
  getEntryUsersList,
};
