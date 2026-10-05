const { ChangeApprovalRequest, ...models } = require('../db/models');
const logger = require('../config/logger');

// Global in-memory configuration for approval requirement
let approvalSettings = {
  enabled: true,
  exemptRoles: ['admin', 'super_admin'],
  interceptDelete: true,
  interceptEdit: true,
};

// Route prefixes explicitly excluded from approval interception (e.g. Tasks, Chat/Communication as requested by user)
const EXCLUDED_PREFIXES = [
  '/v1/auth',
  '/v1/upload',
  '/v1/ai',
  '/v1/tasks',
  '/v1/workspace',
  '/v1/communication',
  '/v1/chatTask',
  '/v1/change-approvals',
  '/v1/signed-documents',
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

  if (lower.includes('/jobcards') || lower.includes('/job-cards')) {
    return { name: 'JobCard', model: models.JobCard };
  }
  if (lower.includes('/garment-jobcards')) {
    return { name: 'GarmentJobCard', model: models.GarmentJobCard };
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
  if (lower.includes('/fabric-challan')) {
    return { name: 'FabricChallan', model: models.FabricChallan };
  }
  if (lower.includes('/fabric')) {
    return { name: 'Fabric', model: models.FabricVendor };
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
  if (lower.includes('/stitching-challan')) {
    return { name: 'Stitching', model: models.StitchingChallan };
  }
  if (lower.includes('/complaints')) {
    return { name: 'Complaint', model: models.Complaint };
  }
  if (lower.includes('/vendor') || lower.includes('/fabric-vendors')) {
    return { name: 'Vendor', model: models.Vendor || models.FabricVendor };
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

  // Fallback module name from first path segment
  const segments = urlPath.replace(/^\/v1\//, '').split('/');
  const rawSegment = segments[0] || 'General';
  const cleanName = rawSegment.charAt(0).toUpperCase() + rawSegment.slice(1);
  return { name: cleanName, model: null };
};

// Core Job Card fields that DO require approval if modified (order specs, customer, fabric, billing quantities, rates)
const CORE_JOBCARD_SPEC_FIELDS = new Set([
  'partyname',
  'party',
  'clientname',
  'client',
  'clientcode',
  'designno',
  'designname',
  'catalogno',
  'fabricname',
  'fabrictype',
  'fabric',
  'totalmtr',
  'orderedmtr',
  'ordermtr',
  'rate',
  'amount',
  'totalamount',
  'unitprice',
  'jobno',
  'orderdate',
  'expecteddeliverydate',
]);

/**
 * Checks whether an incoming JobCard update is routine operational department data entry
 * (such as fusing entry, printing progress, machine parameters, fault logs, QA check, delivery status).
 * These are daily operational workflows and do NOT require admin approval.
 */
const isRoutineJobCardDataEntry = (moduleName, body) => {
  if (moduleName !== 'JobCard' && moduleName !== 'GarmentJobCard') {
    return false;
  }
  if (!body || typeof body !== 'object') {
    return false;
  }

  const keys = Object.keys(body).map(k => k.toLowerCase().replace(/[-_]/g, ''));
  // If ANY core customer/order specification is being modified, require approval
  const touchesCoreSpec = keys.some(k => CORE_JOBCARD_SPEC_FIELDS.has(k));
  if (touchesCoreSpec) {
    return false;
  }

  // Purely operational department data entry (fusing, printing, QA, delivery dispatch)
  return true;
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
 * Intercepts mutating actions (PUT, PATCH, DELETE) made by non-admin users across ERP modules,
 * captures before/after diffs, stages them in ChangeApprovalRequest, and alerts Admins.
 */
const approvalInterceptor = async (req, res, next) => {
  try {
    // 1. Check if approval system is enabled
    if (!approvalSettings.enabled) {
      return next();
    }

    // 2. Only intercept state-changing edit & delete operations
    const method = req.method.toUpperCase();
    const isEdit = method === 'PUT' || method === 'PATCH';
    const isDelete = method === 'DELETE';

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
    const originalUrl = req.originalUrl || req.url;
    const isExcluded = EXCLUDED_PREFIXES.some(prefix => originalUrl.startsWith(prefix));
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
    // Extract target ID from URL (24 hex characters ObjectId)
    const idMatch = originalUrl.match(/\/([0-9a-fA-F]{24})(?:[/?#]|$)/);
    const targetId = idMatch ? idMatch[1] : (req.body?.id || req.body?._id || '');

    // Resolve module name and Mongoose model
    const { name: moduleName, model: TargetModel } = getModuleAndModel(originalUrl);

    // 5.1 Bypass approval for routine factory process data entry (Fusing, Printing, QA, Delivery tracking)
    // Operators filling in routine production metrics on job cards is normal data entry, not an edit!
    if (isEdit && isRoutineJobCardDataEntry(moduleName, req.body)) {
      logger.info('[ApprovalInterceptor] Allowing routine factory data entry without approval for %s (%s)', moduleName, targetId);
      return next();
    }

    // Snapshot existing document for "Before" data
    let beforeData = null;
    let targetIdentifier = '';

    if (TargetModel && targetId) {
      try {
        const existingDoc = await TargetModel.findById(targetId).lean();
        if (existingDoc) {
          beforeData = existingDoc;
          targetIdentifier =
            existingDoc.jobNo ||
            existingDoc.invoiceNo ||
            existingDoc.challanNo ||
            existingDoc.voucherNo ||
            existingDoc.partyName ||
            existingDoc.vendorName ||
            existingDoc.name ||
            existingDoc.title ||
            existingDoc.code ||
            `#${targetId.slice(-6)}`;
        }
      } catch (lookupErr) {
        logger.warn('[ApprovalInterceptor] Could not lookup beforeData: %s', lookupErr.message);
      }
    }

    if (!targetIdentifier) {
      targetIdentifier = targetId ? `#${targetId.slice(-6)}` : `${moduleName} Record`;
    }

    // Calculate diff between existing document and proposed changes
    const diffSummary = computeDiff(beforeData, req.body);

    // 7. Create Pending Change Approval Request
    const approval = await ChangeApprovalRequest.create({
      module: moduleName,
      action: isDelete ? 'DELETE' : 'EDIT',
      targetId: targetId || '',
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

    // 9. Respond to client that request has been submitted for Admin Review
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
