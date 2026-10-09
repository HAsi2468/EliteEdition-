const mongoose = require('mongoose');
const { ChangeApprovalRequest, ...models } = require('../db/models');
const logger = require('../config/logger');

// Global in-memory configuration for approval requirement
let approvalSettings = {
  enabled: true,
  exemptRoles: ['admin', 'super_admin'],
  interceptDelete: true,
  interceptEdit: true,
};

// Route prefixes explicitly excluded from approval interception (e.g. Chat/Communication, Tasks, Auth, Uploads)
const EXCLUDED_PREFIXES = [
  '/v1/auth',
  '/v1/upload',
  '/v1/ai',
  '/v1/tasks',
  '/v1/workspace',
  '/v1/communication',
  '/v1/chatTask',
  '/v1/change-approvals',
  '/v1/backup',
  '/v1/telemetry',
  '/v1/search',
  '/v1/notifications',
  '/v1/filters_value',
  '/v1/docs',
  '/v1/verify',
];

// Helper to map route paths to friendly module names and Mongoose models
const getModuleAndModel = (urlPath) => {
  const lower = urlPath.toLowerCase();

  if (lower.includes('/jobcards') || lower.includes('/job-cards') || lower.includes('/jobcard')) {
    return { name: 'JobCard', model: models.JobCard };
  }
  if (lower.includes('/garment-jobcards') || lower.includes('/garment-jobcard')) {
    return { name: 'GarmentJobCard', model: models.GarmentJobCard };
  }
  if (lower.includes('/jobprintlogs') || lower.includes('/job-print-logs')) {
    return { name: 'JobPrintLog', model: models.JobPrintLog };
  }
  if (lower.includes('/jobfusinglogs') || lower.includes('/job-fusing-logs')) {
    return { name: 'JobFusingLog', model: models.JobFusingLog };
  }
  if (lower.includes('/billing')) {
    if (lower.includes('/customers')) return { name: 'BillingCustomer', model: models.BillingCustomer };
    if (lower.includes('/items')) return { name: 'BillingItem', model: models.BillingItem };
    if (lower.includes('/purchases')) return { name: 'BillingPurchase', model: models.BillingPurchase };
    return { name: 'BillingInvoice', model: models.BillingInvoice };
  }
  if (lower.includes('/expenses')) {
    return { name: 'Expense', model: models.Expense };
  }
  if (lower.includes('/costing')) {
    return { name: 'MonthlyCosting', model: models.MonthlyCosting };
  }
  if (lower.includes('/fabric-challan')) {
    return { name: 'FabricChallan', model: models.FabricChallan };
  }
  if (lower.includes('/fabric-vendors')) {
    return { name: 'FabricVendor', model: models.FabricVendor };
  }
  if (lower.includes('/fabric-stock-adjustment') || lower.includes('/fabric-adjustment')) {
    return { name: 'FabricStockAdjustment', model: models.FabricStockAdjustment };
  }
  if (lower.includes('/fabric/white-qa-logs') || lower.includes('/white-qa-logs')) {
    return { name: 'WhiteFabricLog', model: models.WhiteFabricLog };
  }
  if (lower.includes('/fabric')) {
    return { name: 'Fabric', model: models.FabricTransaction || models.Fabric };
  }
  if (lower.includes('/inventory')) {
    return { name: 'Inventory', model: models.Inventory };
  }
  if (lower.includes('/raw-materials')) {
    return { name: 'RawMaterial', model: models.RawMaterialTransaction };
  }
  if (lower.includes('/products')) {
    return { name: 'Product', model: models.Product };
  }
  if (lower.includes('/designs')) {
    return { name: 'Design', model: models.Design };
  }
  if (lower.includes('/designer-tasks')) {
    return { name: 'DesignerTask', model: models.DesignerTask };
  }
  if (lower.includes('/stitching-challan')) {
    return { name: 'StitchingChallan', model: models.StitchingChallan };
  }
  if (lower.includes('/stitching-config')) {
    return { name: 'StitchingConfig', model: models.StitchingConfig };
  }
  if (lower.includes('/print-config')) {
    return { name: 'PrintConfig', model: models.PrintConfig };
  }
  if (lower.includes('/complaints')) {
    return { name: 'Complaint', model: models.Complaint };
  }
  if (lower.includes('/vendor')) {
    return { name: 'Vendor', model: models.Vendor };
  }
  if (lower.includes('/party')) {
    return { name: 'Party', model: models.Party };
  }
  if (lower.includes('/clients')) {
    return { name: 'Client', model: models.Client };
  }
  if (lower.includes('/customer-profiles')) {
    return { name: 'CustomerProfile', model: models.CustomerProfile };
  }
  if (lower.includes('/leads')) {
    return { name: 'Lead', model: models.Lead };
  }
  if (lower.includes('/facilities')) {
    return { name: 'Facility', model: models.Facility };
  }
  if (lower.includes('/infra-bills')) {
    return { name: 'InfrastructureBill', model: models.InfrastructureBill };
  }
  if (lower.includes('/returns')) {
    return { name: 'ReturnRecord', model: models.ReturnRecord };
  }
  if (lower.includes('/myntra')) {
    return { name: 'MyntraConfig', model: models.MyntraConfig };
  }
  if (lower.includes('/stockout') || lower.includes('/stock-out')) {
    return { name: 'StockOut', model: models.StockOut };
  }
  if (lower.includes('/saleslist') || lower.includes('/sale-orders') || lower.includes('/oms')) {
    return { name: 'SaleOrder', model: models.SaleOrder || models.SalesList };
  }
  if (lower.includes('/signed-documents')) {
    return { name: 'SignedDocument', model: null };
  }

  // Fallback module name from first path segment
  const segments = urlPath.replace(/^\/(?:api\/)?v1\//, '').split('/');
  const rawSegment = segments[0] || 'General';
  const cleanName = rawSegment.charAt(0).toUpperCase() + rawSegment.slice(1);
  return { name: cleanName, model: models[cleanName] || null };
};

// Calculate field-by-field diff between old and new state
const computeDiff = (beforeObj, afterObj) => {
  const diffs = [];
  if (!beforeObj || !afterObj) return diffs;

  const ignoreKeys = new Set([
    '_id', 'id', '__v', 'createdAt', 'updatedAt', 'csrfToken',
    'idempotencyKey', 'Idempotency-Key', 'x-csrf-token'
  ]);

  for (const [key, afterVal] of Object.entries(afterObj)) {
    if (ignoreKeys.has(key)) continue;

    const beforeVal = beforeObj[key];
    const beforeStr = typeof beforeVal === 'object' ? JSON.stringify(beforeVal) : String(beforeVal ?? '');
    const afterStr = typeof afterVal === 'object' ? JSON.stringify(afterVal) : String(afterVal ?? '');

    if (beforeStr !== afterStr) {
      diffs.push({
        field: key,
        before: beforeVal !== undefined ? beforeVal : null,
        after: afterVal,
      });
    }
  }
  return diffs;
};

/**
 * Universal Approval Interceptor Middleware
 * Intercepts mutating actions (PUT, PATCH, DELETE, and POST update endpoints)
 * made by non-admin users across all ERP screens & modules,
 * captures before/after diffs, stages them in ChangeApprovalRequest,
 * broadcasts alerts to Admins via Socket.IO, and returns a 202 Accepted response.
 */
const approvalInterceptor = async (req, res, next) => {
  try {
    // 1. Check if approval system is enabled
    if (!approvalSettings.enabled) {
      return next();
    }

    // 2. Identify mutating edit & delete operations
    const method = req.method.toUpperCase();
    const originalUrl = req.originalUrl || req.url;
    const lowerUrl = originalUrl.toLowerCase();

    const isExplicitEdit = method === 'PUT' || method === 'PATCH';
    const isExplicitDelete = method === 'DELETE';
    const isPostUpdate =
      method === 'POST' &&
      (lowerUrl.includes('/update') ||
        lowerUrl.includes('/edit') ||
        lowerUrl.includes('/status') ||
        lowerUrl.includes('/modify') ||
        lowerUrl.includes('/adjust') ||
        lowerUrl.includes('/save') ||
        lowerUrl.includes('/calc-cost') ||
        lowerUrl.includes('/rebalance') ||
        lowerUrl.includes('/refinish') ||
        lowerUrl.includes('/process') ||
        lowerUrl.includes('/clear-all'));

    const isPostDelete =
      method === 'POST' &&
      (lowerUrl.includes('/delete') || lowerUrl.includes('/remove') || lowerUrl.includes('/clear-all'));

    const isEdit = isExplicitEdit || (isPostUpdate && !isPostDelete);
    const isDelete = isExplicitDelete || isPostDelete;

    if (!isEdit && !isDelete) {
      return next();
    }

    // 3. Skip internal execution replays triggered by Admin approval
    if (
      req.headers['x-approval-execution'] === 'true' ||
      req.isApprovalExecution === true
    ) {
      return next();
    }

    // 4. Check if the route is excluded (Tasks, Chat/Communication, Auth, Uploads, etc.)
    const isExcluded = EXCLUDED_PREFIXES.some((prefix) => originalUrl.startsWith(prefix));
    if (isExcluded) {
      return next();
    }

    // 5. Check if user has Admin privileges (Admins bypass approval)
    const userRole = (req.user?.role || req.headers['x-user-role'] || '').toLowerCase();
    const isAdmin =
      userRole === 'admin' ||
      userRole === 'super_admin' ||
      req.user?.isAdmin === true ||
      req.user?.isMainAdmin === true ||
      req.headers['x-is-admin'] === 'true' ||
      req.user?.email === 'harshitsidapara2468@gmail.com';

    if (isAdmin) {
      return next();
    }

    // 6. User is a non-admin attempting an edit or delete!
    // Extract target ID from URL, params, body, or query
    const idMatch = originalUrl.match(/\/([0-9a-fA-F]{24})(?:[/?#]|$)/);
    const targetId =
      (idMatch ? idMatch[1] : '') ||
      req.params?.id ||
      req.body?.id ||
      req.body?._id ||
      req.body?.targetId ||
      req.body?.jobCardId ||
      req.query?.id ||
      '';

    // Resolve module name and Mongoose model
    const { name: moduleName, model: TargetModel } = getModuleAndModel(originalUrl);

    // If non-admin is doing routine shop-floor stage logging (Print/Fusing progress) on JobCard
    // without altering master order specifications (party, totalMtr, fabric, design), do not block
    if (moduleName === 'JobCard' && !isDelete && req.body) {
      const masterFields = ['party', 'partyName', 'clientName', 'totalMtr', 'fabric', 'fabricName', 'designNo', 'designName', 'pcs', 'panna', 'billNo'];
      const touchesMaster = masterFields.some(f => req.body[f] !== undefined);
      const isRoutineStageLog = !touchesMaster && (
        req.body.fusingStatus !== undefined ||
        req.body.printStatus !== undefined ||
        req.body.deliveryStatus !== undefined ||
        req.body.freshMtr !== undefined ||
        req.body.fusingMtr !== undefined ||
        req.body.printMtr !== undefined ||
        req.body.fusingOperator !== undefined ||
        req.body.operatorName !== undefined ||
        req.body.fusingDate !== undefined ||
        req.body.printDate !== undefined
      );
      if (isRoutineStageLog) {
        return next();
      }
    }

    // Snapshot existing document for "Before" data
    let beforeData = null;
    let targetIdentifier = '';

    if (TargetModel && targetId) {
      try {
        let existingDoc = null;
        if (mongoose.Types.ObjectId.isValid(targetId)) {
          existingDoc = await TargetModel.findById(targetId).lean();
        }
        if (!existingDoc) {
          existingDoc = await TargetModel.findOne({
            $or: [
              { id: targetId },
              { jobNo: targetId },
              { invoiceNo: targetId },
              { challanNo: targetId },
              { lotNo: targetId },
              { code: targetId },
              { name: targetId },
            ],
          }).lean();
        }

        if (existingDoc) {
          beforeData = existingDoc;
          targetIdentifier =
            (existingDoc.lotNo ? `Lot #${existingDoc.lotNo}` : '') ||
            (existingDoc.jobNo ? `Job #${existingDoc.jobNo}` : '') ||
            (existingDoc.invoiceNo ? `Invoice #${existingDoc.invoiceNo}` : '') ||
            (existingDoc.challanNo ? `Challan #${existingDoc.challanNo}` : '') ||
            (existingDoc.voucherNo ? `Voucher #${existingDoc.voucherNo}` : '') ||
            (existingDoc.partyName ? `Party: ${existingDoc.partyName}` : '') ||
            (existingDoc.vendorName ? `Vendor: ${existingDoc.vendorName}` : '') ||
            existingDoc.name ||
            existingDoc.title ||
            existingDoc.code ||
            `#${String(targetId).slice(-6)}`;
        }
      } catch (lookupErr) {
        logger.warn('[ApprovalInterceptor] Could not lookup beforeData: %s', lookupErr.message);
      }
    }

    if (!targetIdentifier) {
      targetIdentifier = targetId ? `#${String(targetId).slice(-6)}` : `${moduleName} Record`;
    }

    // Calculate diff between existing document and proposed changes
    const diffSummary = computeDiff(beforeData, req.body || {});

    // 7. Create Pending Change Approval Request
    const approval = await ChangeApprovalRequest.create({
      module: moduleName,
      action: isDelete ? 'DELETE' : 'EDIT',
      targetId: String(targetId || ''),
      targetIdentifier,
      targetEndpoint: originalUrl,
      httpMethod: method,
      requestBody: req.body || {},
      requestQuery: req.query || {},
      beforeData,
      afterData: req.body || {},
      diffSummary,
      requestedBy: {
        userId: String(req.user?._id || req.user?.id || req.headers['x-user-id'] || 'user'),
        name: req.user?.name || req.user?.username || req.headers['x-user-name'] || 'Staff User',
        email: req.user?.email || '',
        role: req.user?.role || 'user',
        department: req.user?.department || 'General',
      },
      status: 'PENDING',
    });

    logger.info(
      '[ApprovalInterceptor] Captured non-admin %s on %s (%s) by %s',
      approval.action,
      approval.module,
      approval.targetIdentifier,
      approval.requestedBy.name
    );

    // 8. Broadcast real-time socket alert to all connected Admins
    try {
      const io = global.io || (req.app && req.app.get('io'));
      if (io) {
        io.emit('new-approval-request', {
          id: approval._id,
          module: approval.module,
          action: approval.action,
          targetIdentifier: approval.targetIdentifier,
          requestedBy: approval.requestedBy,
          createdAt: approval.createdAt,
        });
      }
    } catch (sockErr) {
      logger.warn('[ApprovalInterceptor] Socket broadcast failed: %s', sockErr.message);
    }

    // 9. Respond to client with 202 Accepted and requiresApproval flag
    return res.status(202).json({
      success: true,
      requiresApproval: true,
      approvalId: approval._id,
      message: 'Action submitted for Admin Review & Approval. The changes will take effect once approved by an Admin.',
      data: {
        id: approval._id,
        module: approval.module,
        action: approval.action,
        targetIdentifier: approval.targetIdentifier,
        status: 'PENDING',
        createdAt: approval.createdAt,
      },
    });
  } catch (err) {
    logger.error('[ApprovalInterceptor] Interceptor error: %o', err);
    // On unexpected interceptor error, let request proceed safely to prevent system locking
    return next();
  }
};

module.exports = {
  approvalInterceptor,
  getApprovalSettings: () => ({ ...approvalSettings }),
  setApprovalSettings: (newSettings) => {
    approvalSettings = { ...approvalSettings, ...newSettings };
    return approvalSettings;
  },
};
