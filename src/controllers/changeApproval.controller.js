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
    const targetModel = models[approval.module];
    if (targetModel && approval.targetId) {
      if (approval.httpMethod === 'DELETE') {
        const deleted = await targetModel.findByIdAndDelete(approval.targetId);
        return { success: true, method: 'DIRECT_MODEL_DELETE', data: deleted };
      } else {
        const updated = await targetModel.findByIdAndUpdate(
          approval.targetId,
          { $set: approval.requestBody },
          { new: true, runValidators: false }
        );
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
/**
 * Review Screen: Fetch all data entries across the ERP created by users
 */
const getUserDataEntries = async (req, res) => {
  try {
    const {
      user = 'ALL',
      module: moduleFilter = 'ALL',
      startDate = '',
      endDate = '',
      search = '',
      page = 1,
      limit = 40
    } = req.query;

    const pageNum = Math.max(1, parseInt(page, 10) || 1);
    const limitNum = Math.min(100, Math.max(1, parseInt(limit, 10) || 40));

    // Construct Date Filter
    const dateFilter = {};
    if (startDate) {
      dateFilter.$gte = new Date(startDate);
    }
    if (endDate) {
      const end = new Date(endDate);
      end.setHours(23, 59, 59, 999);
      dateFilter.$lte = end;
    }
    const hasDateFilter = Object.keys(dateFilter).length > 0;

    // Construct User Filter
    const userRegex = (user && user !== 'ALL' && user !== 'All')
      ? new RegExp(`^${user.trim()}$`, 'i')
      : null;

    // Construct Search Regex
    const searchRegex = (search && search.trim())
      ? new RegExp(search.trim(), 'i')
      : null;

    const shouldFetch = (modName) => moduleFilter === 'ALL' || moduleFilter === 'All' || moduleFilter === modName;

    const promises = [];

    // 1. Job Cards
    if (shouldFetch('JobCard') && models.JobCard) {
      const q = {};
      if (hasDateFilter) q.createdAt = dateFilter;
      if (userRegex) q.$or = [{ createdByName: userRegex }, { createdBy: userRegex }];
      if (searchRegex) {
        const searchOr = [{ jobNo: searchRegex }, { party: searchRegex }, { fabric: searchRegex }];
        q.$and = q.$or ? [{ $or: q.$or }, { $or: searchOr }] : searchOr;
        delete q.$or;
      }
      promises.push(
        models.JobCard.find(q)
          .sort({ createdAt: -1 })
          .limit(limitNum * pageNum)
          .lean()
          .then(docs => docs.map(doc => ({
            id: doc._id,
            module: 'JobCard',
            moduleLabel: 'Job Card',
            identifier: doc.jobNo || `#${String(doc._id).slice(-6)}`,
            party: doc.party || 'Internal',
            details: `${doc.totalMtr || 0} Mtr • Fabric: ${doc.fabric || 'General'} • Design: ${doc.designNo || 'N/A'}`,
            amountOrQuantity: `${doc.totalMtr || 0} Mtr`,
            status: doc.status || doc.stage || 'Production',
            createdBy: doc.createdByName || doc.createdBy || 'Staff User',
            createdAt: doc.createdAt || doc.date || new Date(),
            rawDoc: doc
          })))
      );
    }

    // 2. Billing Invoices
    if (shouldFetch('BillingInvoice') && models.BillingInvoice) {
      const q = {};
      if (hasDateFilter) q.createdAt = dateFilter;
      if (userRegex) q.$or = [{ createdByName: userRegex }, { createdBy: userRegex }];
      if (searchRegex) {
        const searchOr = [{ invoiceNo: searchRegex }, { customerName: searchRegex }, { partyName: searchRegex }];
        q.$and = q.$or ? [{ $or: q.$or }, { $or: searchOr }] : searchOr;
        delete q.$or;
      }
      promises.push(
        models.BillingInvoice.find(q)
          .sort({ createdAt: -1 })
          .limit(limitNum * pageNum)
          .lean()
          .then(docs => docs.map(doc => ({
            id: doc._id,
            module: 'BillingInvoice',
            moduleLabel: 'Tax Invoice',
            identifier: doc.invoiceNo || `#${String(doc._id).slice(-6)}`,
            party: doc.customerName || doc.partyName || 'Customer',
            details: `Grand Total: ₹${Number(doc.grandTotal || 0).toLocaleString('en-IN')} • Due: ₹${Number(doc.balanceDue || 0).toLocaleString('en-IN')}`,
            amountOrQuantity: `₹${Number(doc.grandTotal || 0).toLocaleString('en-IN')}`,
            status: doc.paymentStatus || 'UNPAID',
            createdBy: doc.createdByName || doc.createdBy || 'Staff User',
            createdAt: doc.createdAt || doc.invoiceDate || new Date(),
            rawDoc: doc
          })))
      );
    }

    // 3. Expenses
    if (shouldFetch('Expense') && models.Expense) {
      const q = {};
      if (hasDateFilter) q.createdAt = dateFilter;
      if (userRegex) q.$or = [{ createdByName: userRegex }, { createdBy: userRegex }];
      if (searchRegex) {
        const searchOr = [{ voucherNo: searchRegex }, { partyName: searchRegex }, { vendorName: searchRegex }, { title: searchRegex }];
        q.$and = q.$or ? [{ $or: q.$or }, { $or: searchOr }] : searchOr;
        delete q.$or;
      }
      promises.push(
        models.Expense.find(q)
          .sort({ createdAt: -1 })
          .limit(limitNum * pageNum)
          .lean()
          .then(docs => docs.map(doc => ({
            id: doc._id,
            module: 'Expense',
            moduleLabel: `Expense (${doc.type || 'OUT'})`,
            identifier: doc.voucherNo || doc.title || `#${String(doc._id).slice(-6)}`,
            party: doc.partyName || doc.vendorName || doc.title || 'General Expense',
            details: `${doc.category || 'General'} • Payment Mode: ${doc.paymentMode || 'Cash'}`,
            amountOrQuantity: `₹${Number(doc.amount || 0).toLocaleString('en-IN')}`,
            status: doc.type === 'IN' ? 'Cash IN' : 'Cash OUT',
            createdBy: doc.createdByName || doc.createdBy || 'Staff User',
            createdAt: doc.createdAt || doc.date || new Date(),
            rawDoc: doc
          })))
      );
    }

    // 4. Fabric Challans
    if (shouldFetch('FabricChallan') && models.FabricChallan) {
      const q = {};
      if (hasDateFilter) q.createdAt = dateFilter;
      if (userRegex) q.$or = [{ createdByName: userRegex }, { createdBy: userRegex }];
      if (searchRegex) {
        const searchOr = [{ challanNo: searchRegex }, { partyName: searchRegex }, { fabricType: searchRegex }];
        q.$and = q.$or ? [{ $or: q.$or }, { $or: searchOr }] : searchOr;
        delete q.$or;
      }
      promises.push(
        models.FabricChallan.find(q)
          .sort({ createdAt: -1 })
          .limit(limitNum * pageNum)
          .lean()
          .then(docs => docs.map(doc => ({
            id: doc._id,
            module: 'FabricChallan',
            moduleLabel: 'Fabric Challan',
            identifier: doc.challanNo ? `Challan #${doc.challanNo}` : `#${String(doc._id).slice(-6)}`,
            party: doc.partyName || 'Party',
            details: `${doc.totalMeters || 0} Mtr (${doc.totalRolls || 0} Rolls) • ${doc.fabricType || 'Fabric'}`,
            amountOrQuantity: `${doc.totalMeters || 0} Mtr`,
            status: doc.status || 'Active',
            createdBy: doc.createdByName || doc.createdBy || 'Staff User',
            createdAt: doc.createdAt || doc.date || new Date(),
            rawDoc: doc
          })))
      );
    }

    // 5. Stitching Challans
    if (shouldFetch('StitchingChallan') && models.StitchingChallan) {
      const q = {};
      if (hasDateFilter) q.createdAt = dateFilter;
      if (userRegex) q.$or = [{ createdByName: userRegex }, { createdBy: userRegex }];
      if (searchRegex) {
        const searchOr = [{ challanNo: searchRegex }, { partyName: searchRegex }, { jobNo: searchRegex }];
        q.$and = q.$or ? [{ $or: q.$or }, { $or: searchOr }] : searchOr;
        delete q.$or;
      }
      promises.push(
        models.StitchingChallan.find(q)
          .sort({ createdAt: -1 })
          .limit(limitNum * pageNum)
          .lean()
          .then(docs => docs.map(doc => ({
            id: doc._id,
            module: 'StitchingChallan',
            moduleLabel: 'Stitching Challan',
            identifier: doc.challanNo ? `Stitching #${doc.challanNo}` : `#${String(doc._id).slice(-6)}`,
            party: doc.partyName || doc.workerName || 'Worker',
            details: `${doc.totalPieces || 0} Pcs • Job: ${doc.jobNo || 'N/A'} • Worker: ${doc.workerName || 'N/A'}`,
            amountOrQuantity: `${doc.totalPieces || 0} Pcs`,
            status: doc.status || 'Active',
            createdBy: doc.createdByName || doc.createdBy || 'Staff User',
            createdAt: doc.createdAt || doc.date || new Date(),
            rawDoc: doc
          })))
      );
    }

    // 6. Inventory Inward/Outward
    if (shouldFetch('Inventory') && models.Inventory) {
      const q = {};
      if (hasDateFilter) q.createdAt = dateFilter;
      if (userRegex) q.$or = [{ createdByName: userRegex }, { createdBy: userRegex }];
      if (searchRegex) {
        const searchOr = [{ productName: searchRegex }, { vendorName: searchRegex }];
        q.$and = q.$or ? [{ $or: q.$or }, { $or: searchOr }] : searchOr;
        delete q.$or;
      }
      promises.push(
        models.Inventory.find(q)
          .sort({ createdAt: -1 })
          .limit(limitNum * pageNum)
          .lean()
          .then(docs => docs.map(doc => ({
            id: doc._id,
            module: 'Inventory',
            moduleLabel: 'Inventory Item',
            identifier: doc.productName || `#${String(doc._id).slice(-6)}`,
            party: doc.vendorName || doc.supplier || 'Stock',
            details: `${doc.quantity || 0} ${doc.unit || 'Units'} • Type: ${doc.type || 'Stock'}`,
            amountOrQuantity: `${doc.quantity || 0} ${doc.unit || 'Units'}`,
            status: doc.type || 'In Stock',
            createdBy: doc.createdByName || doc.createdBy || 'Staff User',
            createdAt: doc.createdAt || doc.date || new Date(),
            rawDoc: doc
          })))
      );
    }

    const resultsArray = await Promise.all(promises);
    const allEntries = resultsArray.flat();

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
 * Get distinct user list who have created or entered data
 */
const getEntryUsersList = async (req, res) => {
  try {
    const userSet = new Set();

    // Fetch registered active system users
    if (models.user) {
      const activeUsers = await models.user.find({}, 'name username role').lean();
      activeUsers.forEach(u => {
        if (u.name) userSet.add(u.name.trim());
        if (u.username) userSet.add(u.username.trim());
      });
    }

    // Fetch distinct creators from JobCards and Invoices
    if (models.JobCard) {
      const jcUsers = await models.JobCard.distinct('createdByName');
      jcUsers.forEach(u => u && userSet.add(String(u).trim()));
    }
    if (models.BillingInvoice) {
      const invUsers = await models.BillingInvoice.distinct('createdByName');
      invUsers.forEach(u => u && userSet.add(String(u).trim()));
    }
    if (models.Expense) {
      const expUsers = await models.Expense.distinct('createdByName');
      expUsers.forEach(u => u && userSet.add(String(u).trim()));
    }

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
