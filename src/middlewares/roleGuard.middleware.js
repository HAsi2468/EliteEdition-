/**
 * Role & Staff Authorization Guards
 * Enforces strict server-side RBAC on sensitive admin, backup, and finance routes.
 */

function isAdminUser(user) {
  if (!user || user.isClient) return false;
  const roleStr = String(user.role || '').toLowerCase();
  const uname = String(user.username || '').toLowerCase();
  return Boolean(
    user.isMainAdmin ||
    user.isAdmin === true ||
    roleStr === 'admin' ||
    roleStr === 'master_admin' ||
    roleStr === 'master' ||
    uname === 'admin' ||
    uname === 'master'
  );
}

const requireAdmin = (req, res, next) => {
  if (!isAdminUser(req.user)) {
    return res.status(403).json({
      success: false,
      code: 'FORBIDDEN',
      error: 'Administrator privileges required.',
    });
  }
  return next();
};

const requireStaff = (req, res, next) => {
  if (!req.user || req.user.isClient) {
    return res.status(403).json({
      success: false,
      code: 'FORBIDDEN',
      error: 'Internal staff authorization required.',
    });
  }
  return next();
};

module.exports = {
  isAdminUser,
  requireAdmin,
  requireStaff,
};
