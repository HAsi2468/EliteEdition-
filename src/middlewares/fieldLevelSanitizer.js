/**
 * Field-Level Access Control (FLAC) Projection Sanitizer
 *
 * Intercepts outbound HTTP responses (res.json) and dynamically strips sensitive
 * financial, costing, supplier, or technical machine parameters based on the authenticated
 * user's role:
 *
 * 1. External Clients (role: 'Client' or isClient: true):
 *    - Strips internal production costs, supplier rates, gross margins, internal notes,
 *      vendor names, and proprietary machine configurations.
 *
 * 2. Floor Operators (role: 'operator' | 'printer' | 'fusing_operator'):
 *    - Strips commercial billing totals, party billing balances, and client invoice pricing.
 *    - Preserves all production fields (meterage, roll counts, fabric, colorways, panna).
 *
 * 3. Administrators & Management (admin, super_admin, manager):
 *    - Retains complete, unmodified records with zero redaction.
 */

// Fields restricted from External Clients
const CLIENT_RESTRICTED_FIELDS = new Set([
  // Production Costing & Margins
  'costPerMeter',
  'unitPricePerSqFt',
  'totalCalculatedCost',
  'costingRate',
  'internalCost',
  'supplierRate',
  'margin',
  'grossMargin',
  'profit',
  'vendorPrice',
  'purchaseRate',
  'cost',

  // Internal Notes & Private Operator Remarks
  'note1',
  'note2',
  'emergencyNotes',
  'internalNotes',
  'operatorRemarks',
  'designerNotes',

  // Supplier & Vendor Metadata
  'vendorChallanNo',
  'vendorName',
  'fabricVendor',

  // Proprietary Machine Calibration Settings
  'temperature',
  'speed',
  'fusingSpeed',
  'fusingTemp',
  'profile',
  'fusingMachine',
  'shift',

  // Credentials and Private Security Tokens
  'password',
  'hash',
  'salt',
  'resetPasswordToken',
]);

// Fields restricted from Floor Operators
const OPERATOR_RESTRICTED_FIELDS = new Set([
  'ratePerMeter',
  'totalAmount',
  'invoices',
  'billNo',
  'billingAmount',
  'paymentStatus',
  'unitPricePerSqFt',
  'totalCalculatedCost',
  'costingRate',
  'margin',
  'grossMargin',
  'profit',
]);

/**
 * Recursively removes restricted field keys from an object or array.
 *
 * @param {*} value - The input data structure
 * @param {Set<string>} restrictedSet - Set of keys to omit
 * @returns {*} Sanitized data structure
 */
function sanitizeFields(value, restrictedSet) {
  if (value === null || typeof value !== 'object') {
    return value;
  }

  // Handle Mongoose documents by converting to plain JS object if toObject exists
  if (typeof value.toObject === 'function') {
    value = value.toObject();
  }

  if (Array.isArray(value)) {
    return value.map((item) => sanitizeFields(item, restrictedSet));
  }

  // Handle Dates, Buffers, RegExps without traversing their internal properties
  if (value instanceof Date || value instanceof RegExp || Buffer.isBuffer(value)) {
    return value;
  }

  const cleaned = {};
  for (const [key, val] of Object.entries(value)) {
    if (restrictedSet.has(key)) {
      continue; // Strip restricted field
    }

    // Special handling for nested printSpecifications object
    if (key === 'printSpecifications' && typeof val === 'object' && val !== null) {
      const sanitizedPrintSpec = sanitizeFields(val, restrictedSet);
      // Clean up sensitive fields inside printSpecifications for clients
      if (restrictedSet.has('unitPricePerSqFt')) {
        delete sanitizedPrintSpec.unitPricePerSqFt;
        delete sanitizedPrintSpec.totalCalculatedCost;
      }
      cleaned[key] = sanitizedPrintSpec;
      continue;
    }

    cleaned[key] = sanitizeFields(val, restrictedSet);
  }

  return cleaned;
}

/**
 * Middleware: Field-Level Access Control (FLAC) Projection Sanitizer
 *
 * Wraps `res.json` to automatically filter response data according to caller privileges.
 */
const fieldLevelSanitizer = (req, res, next) => {
  const user = req.user;
  const isClient =
    req.isClient ||
    user?.role === 'Client' ||
    user?.role === 'client' ||
    user?.isClient === true ||
    req.headers['x-user-role'] === 'Client' ||
    req.headers['x-user-role'] === 'client';

  const userRole = String(user?.role || req.headers['x-user-role'] || '').toLowerCase();
  const isOperator =
    userRole === 'operator' ||
    userRole === 'printer' ||
    userRole === 'fusing_operator';

  // If user is Admin / Super Admin, no redaction required
  if (!isClient && !isOperator) {
    return next();
  }

  const restrictedSet = isClient
    ? CLIENT_RESTRICTED_FIELDS
    : OPERATOR_RESTRICTED_FIELDS;

  // Intercept res.json
  const originalJson = res.json.bind(res);

  res.json = function (body) {
    try {
      if (body !== null && typeof body === 'object') {
        const sanitized = sanitizeFields(body, restrictedSet);
        return originalJson(sanitized);
      }
    } catch (err) {
      console.warn('[fieldLevelSanitizer] Failed to sanitize response body:', err.message);
    }
    return originalJson(body);
  };

  next();
};

module.exports = {
  fieldLevelSanitizer,
  sanitizeFields,
  CLIENT_RESTRICTED_FIELDS,
  OPERATOR_RESTRICTED_FIELDS,
};
