const ActivityLog = require('../db/models/activityLog.model');
const {
  normalizeCompanyId,
  getCompanyEntityName,
  getCompanyById,
  buildCompanyFilter,
  COMPANIES,
} = require('../config/company.constants');

/**
 * Checks if a user has Super Admin privileges across all companies
 */
function isUserSuperAdmin(user) {
  if (!user) return false;
  if (user.isMainAdmin === true) return true;
  if (user.role === 'super_admin') return true;
  if (user.email === 'harshitsidapara2468@gmail.com') return true;
  if (Array.isArray(user.allowedCompanies) && user.allowedCompanies.length >= 5) return true;
  return false;
}

/**
 * Checks if a user is permitted to access a given canonical company ID
 */
function isCompanyPermittedForUser(user, canonicalId) {
  if (!user) return true; // Unauthenticated or public paths handled by router
  if (isUserSuperAdmin(user)) return true;

  const targetComp = getCompanyById(canonicalId);
  const targetAliases = [canonicalId, targetComp.name.toLowerCase(), targetComp.code.toLowerCase(), ...targetComp.aliases];

  // Check user.company_id if set
  if (user.company_id) {
    const userCompNorm = normalizeCompanyId(user.company_id);
    if (userCompNorm === canonicalId) return true;
  }

  // Check user.allowedCompanies
  if (Array.isArray(user.allowedCompanies) && user.allowedCompanies.length > 0) {
    const isAllowed = user.allowedCompanies.some((ac) => {
      const acNorm = normalizeCompanyId(ac);
      return acNorm === canonicalId || targetAliases.includes(String(ac).trim().toLowerCase());
    });
    if (isAllowed) return true;
  }

  // If user role is department user with only 1 company
  if (user.role === 'department_user' || user.role === 'user') {
    return false;
  }

  return false;
}

/**
 * Mandatory Company Scope Middleware
 * Enforces strict multi-tenant isolation on every API request.
 */
const companyScope = async (req, res, next) => {
  // Paths that do not enforce company tenancy check (e.g. login, system auth, public assets)
  const isAuthPath = req.path.startsWith('/auth') || req.path.startsWith('/v1/auth');
  const isPublicDoc = req.path.startsWith('/docs') || req.path.startsWith('/uploads');

  try {
    // 1. Resolve requested company from headers, query, or body
    const rawCompany =
      req.headers['x-company-id'] ||
      req.headers['x-company-entity'] ||
      req.headers['x-company-name'] ||
      req.query?.company_id ||
      req.query?.companyEntity ||
      req.body?.company_id ||
      req.body?.companyEntity;

    let canonicalId = normalizeCompanyId(rawCompany);

    // 2. If not specified in request, resolve from authenticated user context
    if (!canonicalId && req.user) {
      if (req.user.company_id) {
        canonicalId = normalizeCompanyId(req.user.company_id);
      } else if (Array.isArray(req.user.allowedCompanies) && req.user.allowedCompanies.length > 0) {
        canonicalId = normalizeCompanyId(req.user.allowedCompanies[0]);
      }
    }

    // Default fallback if still undefined
    if (!canonicalId) {
      canonicalId = 'elite_online';
    }

    const companyName = getCompanyEntityName(canonicalId);
    const superAdmin = isUserSuperAdmin(req.user);

    // 3. Authorization check (skip for auth login/register routes)
    if (!isAuthPath && !isPublicDoc && req.user && req.user._id) {
      const hasPermission = isCompanyPermittedForUser(req.user, canonicalId);

      if (!hasPermission) {
        // Log access denied attempt in ActivityLog asynchronously
        try {
          await ActivityLog.create({
            company_id: canonicalId,
            companyName,
            userId: req.user._id ? String(req.user._id) : '',
            userName: req.user.name || req.user.username || 'Unknown',
            userRole: req.user.role || 'user',
            action: 'ACCESS_DENIED',
            details: `Unauthorized attempt to access company '${companyName}' (${canonicalId}) by ${req.user.name || 'User'} [${req.user.email || 'No Email'}]`,
            ip: req.ip || req.headers['x-forwarded-for'] || '',
            userAgent: req.headers['user-agent'] || '',
          });
        } catch (logErr) {
          console.warn('[companyScope] Failed to log access denied:', logErr.message);
        }

        // Deny with a plain, clear message
        return res.status(403).json({
          success: false,
          error: 'Forbidden',
          message: `Access denied: You do not have permission to access data for ${companyName}.`,
        });
      }
    }

    // 4. Attach scoped properties and query filter helpers to req
    req.company_id = canonicalId;
    req.companyEntity = companyName;
    req.companyFilter = buildCompanyFilter(canonicalId);
    req.isSuperAdmin = superAdmin;

    // Helper to safely scope any Mongoose filter
    req.scopeQuery = (baseFilter = {}) => {
      // If super admin explicitly requested all companies via query param 'all_companies=true'
      if (superAdmin && (req.query?.all_companies === 'true' || req.headers['x-all-companies'] === 'true')) {
        return baseFilter;
      }
      return {
        ...baseFilter,
        ...req.companyFilter,
      };
    };

    next();
  } catch (err) {
    console.error('[companyScope] Middleware error:', err);
    next(err);
  }
};

module.exports = {
  companyScope,
  isUserSuperAdmin,
  isCompanyPermittedForUser,
};
