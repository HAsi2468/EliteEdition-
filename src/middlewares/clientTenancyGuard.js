const httpStatus = require('http-status').default;
const mongoose = require('mongoose');

/**
 * Extracts and normalizes the Client Tenant Identity from the request context.
 * Returns null if the authenticated user is an administrator, manager, or floor operator.
 *
 * @param {import('express').Request} req
 * @returns {{ clientId: string, companyName: string, companyCode: string, username: string, mobile: string, allowedParties: string[] } | null}
 */
function extractClientIdentity(req) {
  const user = req.user;
  const isClientRole =
    user?.role === 'Client' ||
    user?.role === 'client' ||
    user?.isClient === true ||
    req.headers['x-user-role'] === 'Client' ||
    req.headers['x-user-role'] === 'client';

  if (!isClientRole || !user) {
    return null;
  }

  const companyName = String(user.companyName || '').trim();
  const companyCode = String(user.companyCode || '').trim();
  const username = String(user.username || user.name || '').trim();
  const mobile = String(user.mobile || '').trim();

  // Build list of normalized aliases belonging strictly to this client
  const allowedParties = new Set();
  if (companyName) allowedParties.add(companyName.toLowerCase());
  if (companyCode) allowedParties.add(companyCode.toLowerCase());
  if (username) allowedParties.add(username.toLowerCase());

  return {
    clientId: String(user._id || user.id || ''),
    companyName,
    companyCode,
    username,
    mobile,
    allowedParties: Array.from(allowedParties),
  };
}

/**
 * Checks whether an incoming party string matches any of the client's verified identities.
 *
 * @param {string} partyInput
 * @param {ReturnType<typeof extractClientIdentity>} identity
 * @returns {boolean}
 */
function isPartyAllowedForClient(partyInput, identity) {
  if (!partyInput || !identity) return false;
  const cleanInput = String(partyInput).trim().toLowerCase();
  if (cleanInput === 'all' || cleanInput === '*' || cleanInput === '') {
    return false; // Clients cannot request wildcard/all party access
  }
  return identity.allowedParties.some(
    (allowed) =>
      cleanInput === allowed ||
      cleanInput.includes(allowed) ||
      allowed.includes(cleanInput)
  );
}

/**
 * Middleware: Client Tenancy Guard (Row-Level Security & Invariant Tenant Pinning)
 *
 * Enforces:
 * 1. Immediate rejection (HTTP 403) on unauthorized cross-tenant party filters in req.query or req.body.
 * 2. Immutable row-level pinning: pins req.query.party and req.query.partyName to the authenticated client's company.
 * 3. Mutation protection: pins req.body.party and blocks client modification of unauthorized party records.
 * 4. Rejection of high-privilege administrative actions (DELETE, reset-all, cross-party aggregate reports).
 */
const clientTenancyGuard = (req, res, next) => {
  const identity = extractClientIdentity(req);

  // If user is not an external client (e.g. admin, super_admin, operator), bypass tenancy guard
  if (!identity) {
    return next();
  }

  // 1. Prohibit destructive and admin-only HTTP methods & routes
  if (req.method === 'DELETE') {
    return res.status(httpStatus.FORBIDDEN).json({
      error: 'TENANT_ISOLATION_VIOLATION',
      code: 'METHOD_NOT_ALLOWED_FOR_CLIENT',
      message: 'Access denied: External clients are not permitted to delete production records.',
    });
  }

  const path = req.baseUrl + (req.path || '');
  if (path.includes('/reset-all') || path.includes('/calc-cost') || path.includes('/report/pdf')) {
    return res.status(httpStatus.FORBIDDEN).json({
      error: 'TENANT_ISOLATION_VIOLATION',
      code: 'ADMIN_ROUTE_RESTRICTED',
      message: 'Access denied: External clients are not permitted to access administrative system utilities.',
    });
  }

  // 2. Cross-Tenant Query Parameter Tampering Defense
  const queryParty = req.query.party || req.query.partyName;
  if (queryParty && queryParty !== 'All') {
    if (!isPartyAllowedForClient(queryParty, identity)) {
      return res.status(httpStatus.FORBIDDEN).json({
        error: 'TENANT_ISOLATION_VIOLATION',
        code: 'CROSS_PARTY_ACCESS_DENIED',
        message: `Access denied: You are not authorized to view records for party '${queryParty}'.`,
      });
    }
  }

  // Cryptographically/Invariantly pin query filters to the verified client
  const clientPartyName = identity.companyName || identity.username;
  req.query.party = clientPartyName;
  req.query.partyName = clientPartyName;

  // 3. Cross-Tenant Request Body Tampering Defense (for POST / PUT / PATCH)
  if (req.body && (req.method === 'POST' || req.method === 'PUT' || req.method === 'PATCH')) {
    const bodyParty = req.body.party || req.body.partyName;
    if (bodyParty) {
      if (!isPartyAllowedForClient(bodyParty, identity)) {
        return res.status(httpStatus.FORBIDDEN).json({
          error: 'TENANT_ISOLATION_VIOLATION',
          code: 'CROSS_PARTY_MUTATION_DENIED',
          message: `Access denied: You cannot assign or alter records for party '${bodyParty}'.`,
        });
      }
    }

    // Invariantly pin body party to client
    req.body.party = clientPartyName;
    if (req.body.partyName !== undefined) {
      req.body.partyName = clientPartyName;
    }
    // Tag client creator metadata
    if (req.method === 'POST' && !req.body.createdBy) {
      req.body.createdBy = `Client (${clientPartyName})`;
    }
  }

  // Mark request as tenant-guarded
  req.isClient = true;
  req.clientIdentity = identity;

  next();
};

/**
 * Middleware: Verify Single Record Ownership for Route Parameter Lookups (:id or :jobNo)
 *
 * Validates that an individual requested resource (e.g. GET /jobCards/:id, GET /fabric-challan/:id/pdf)
 * belongs strictly to the client's verified party.
 *
 * @param {'JobCard' | 'FabricChallan'} modelName
 * @param {string} [partyField='party']
 */
function verifyRecordOwnership(modelName, partyField = 'party') {
  return async (req, res, next) => {
    const identity = extractClientIdentity(req);
    if (!identity) {
      return next(); // Admins and internal staff bypass ownership check
    }

    const param = req.params.id || req.params.jobNo;
    if (!param) {
      return next();
    }

    try {
      const db = require('../db/models');
      const Model = db[modelName];
      if (!Model) {
        return next();
      }

      let doc = null;
      if (mongoose.Types.ObjectId.isValid(param)) {
        doc = await Model.findById(param).lean();
      }
      if (!doc && modelName === 'JobCard') {
        const cleanJobNo = String(param).replace(/^JC-/i, '').replace(/^JOB\s*NO\.?\s*[-:]?\s*/i, '').trim();
        const num = parseInt(cleanJobNo, 10);
        const query = { $or: [{ jobNo: cleanJobNo }, { jobNo: String(cleanJobNo) }] };
        if (!isNaN(num)) query.$or.push({ jobNo: num });
        doc = await Model.findOne(query).lean();
      }
      if (!doc && modelName === 'FabricChallan') {
        const num = parseInt(param, 10);
        if (!isNaN(num)) {
          doc = await Model.findOne({ challanNo: num }).lean();
        }
      }

      // If document does not exist, let normal 404 handler deal with it
      if (!doc) {
        return next();
      }

      // Check document party ownership
      const docParty = doc[partyField] || doc.party || doc.partyName || doc.billTo || doc.shipTo || '';
      if (!isPartyAllowedForClient(docParty, identity)) {
        return res.status(httpStatus.FORBIDDEN).json({
          error: 'TENANT_ISOLATION_VIOLATION',
          code: 'RESOURCE_CROSS_TENANT_FORBIDDEN',
          message: 'Access denied: You do not have permission to view or access this resource.',
        });
      }

      req.verifiedDocument = doc;
      next();
    } catch (err) {
      next(err);
    }
  };
}

/**
 * Middleware: Requires Administrator Privileges (Blocks external clients)
 */
function requireAdmin(req, res, next) {
  const identity = extractClientIdentity(req);
  if (identity) {
    return res.status(httpStatus.FORBIDDEN).json({
      error: 'TENANT_ISOLATION_VIOLATION',
      code: 'ADMIN_PRIVILEGE_REQUIRED',
      message: 'Access denied: Administrative privileges are required for this action.',
    });
  }
  next();
}

/**
 * Middleware: Restricts client profile lookups/updates to their own account
 */
function guardClientSelfAccess(req, res, next) {
  const identity = extractClientIdentity(req);
  if (!identity) {
    return next(); // Internal staff/admins can access
  }

  const requestedId = req.params.id;
  if (!requestedId) {
    return next();
  }

  const isSelf =
    requestedId === identity.clientId ||
    requestedId.toLowerCase() === identity.username.toLowerCase() ||
    requestedId === identity.mobile ||
    requestedId.toLowerCase() === identity.companyName.toLowerCase();

  if (!isSelf) {
    return res.status(httpStatus.FORBIDDEN).json({
      error: 'TENANT_ISOLATION_VIOLATION',
      code: 'CLIENT_PROFILE_FORBIDDEN',
      message: 'Access denied: You are only permitted to view or update your own client account.',
    });
  }

  next();
}

module.exports = {
  clientTenancyGuard,
  verifyRecordOwnership,
  extractClientIdentity,
  isPartyAllowedForClient,
  requireAdmin,
  guardClientSelfAccess,
};

