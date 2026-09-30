/**
 * ============================================================================
 * ELITE ERP ENTERPRISE - SAFE REST SEMANTICS GUARD (PHASE 3)
 * Architectural security guard ensuring that no route allows state mutation
 * via idempotent read methods (GET / HEAD).
 * Rejects query parameter-driven deletions, updates, or mutating action paths.
 * ============================================================================
 */

const MUTATION_QUERY_ACTIONS = new Set([
  'delete',
  'destroy',
  'remove',
  'drop',
  'truncate',
  'purge',
  'update',
  'create',
  'mutate',
  'insert',
  'cancel',
]);

const MUTATION_BOOLEAN_FLAGS = new Set([
  'delete',
  'destroy',
  'remove',
  'drop',
  'truncate',
  'purge',
  'mutate',
]);

/**
 * Validates whether an incoming GET/HEAD request is attempting an unsafe mutation.
 * @param {import('express').Request} req
 * @returns {{ unsafe: boolean, reason?: string }}
 */
const isUnsafeGetMutation = (req) => {
  const method = req.method.toUpperCase();
  if (method !== 'GET' && method !== 'HEAD') {
    return { unsafe: false };
  }

  const path = (req.path || req.originalUrl || '').split('?')[0].toLowerCase();
  const query = req.query || {};

  // 1. Query parameter action checks (e.g. ?action=delete)
  const actionParam = typeof query.action === 'string' ? query.action.toLowerCase() : '';
  if (actionParam && MUTATION_QUERY_ACTIONS.has(actionParam)) {
    return {
      unsafe: true,
      reason: `Query parameter 'action=${actionParam}' violates Safe REST semantics for ${method}.`,
    };
  }

  // 2. Boolean mutation flags (e.g. ?delete=true or ?destroy=1)
  for (const flag of MUTATION_BOOLEAN_FLAGS) {
    const val = query[flag];
    if (val === true || val === 'true' || val === '1' || val === 'yes') {
      return {
        unsafe: true,
        reason: `Query parameter '${flag}=${val}' triggers state mutation via ${method}.`,
      };
    }
  }

  // 3. Tunneling method overrides via query (e.g. ?_method=DELETE)
  const methodOverride = typeof query._method === 'string' ? query._method.toUpperCase() : '';
  if (['POST', 'PUT', 'PATCH', 'DELETE'].includes(methodOverride)) {
    return {
      unsafe: true,
      reason: `HTTP method override '_method=${methodOverride}' is not permitted via ${method}.`,
    };
  }

  // 4. Action-driven path suffixes on GET (e.g. /delete?id=123, /items/destroy)
  if (/(?:^|\/)(delete|destroy|truncate|purge)(?:$|\/)/.test(path)) {
    return {
      unsafe: true,
      reason: `Mutating path endpoint '${path}' is not permitted on ${method}. Use POST or DELETE.`,
    };
  }

  return { unsafe: false };
};

/**
 * Express middleware enforcing Safe REST Semantics.
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 * @param {import('express').NextFunction} next
 */
const safeRestGuard = (req, res, next) => {
  const check = isUnsafeGetMutation(req);
  if (check.unsafe) {
    return res.status(405).json({
      error: 'MUTATION_IN_GET_FORBIDDEN',
      message:
        'State mutating actions are strictly prohibited on safe HTTP methods (GET/HEAD). Use POST, PUT, PATCH, or DELETE.',
      detail: check.reason,
    });
  }

  next();
};

module.exports = {
  isUnsafeGetMutation,
  safeRestGuard,
};
