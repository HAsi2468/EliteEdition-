const db = require('../db/models');

let cachedLockDate = null;
let cachedAt = 0;
const CACHE_TTL_MS = 30000;

function invalidateBooksLockCache() {
  cachedLockDate = null;
  cachedAt = 0;
}

function isMasterAdminUser(user) {
  if (!user || typeof user !== 'object') return false;
  const roleStr = String(user.role || '').toLowerCase();
  const uname = String(user.username || '').toLowerCase();
  return Boolean(
    user.isMainAdmin ||
    user.isAdmin === true ||
    roleStr === 'master_admin' ||
    roleStr === 'master' ||
    uname === 'admin' ||
    uname === 'master'
  );
}

async function getBooksLockDate() {
  if (cachedAt && Date.now() - cachedAt < CACHE_TTL_MS) {
    return cachedLockDate;
  }
  try {
    if (!db.PrintConfig) return '';
    const doc = await db.PrintConfig.findOne({ key: 'admin_control_settings' }).lean();
    cachedLockDate = String(doc?.value?.booksLockDate || '').trim();
    cachedAt = Date.now();
    return cachedLockDate;
  } catch {
    return '';
  }
}

/**
 * Checks whether an entry date is frozen by the Admin Books Lock Date.
 * Master Admins can override; all other staff receive a clear lock error.
 */
async function checkBooksLock(entryDate, reqUser) {
  if (isMasterAdminUser(reqUser)) return { locked: false };
  const lockDate = await getBooksLockDate();
  if (!lockDate) return { locked: false };

  const target = entryDate ? new Date(entryDate) : new Date();
  if (Number.isNaN(target.getTime())) return { locked: false };

  const lockEnd = new Date(`${lockDate}T23:59:59.999Z`);
  if (Number.isNaN(lockEnd.getTime())) return { locked: false };

  if (target <= lockEnd) {
    return {
      locked: true,
      lockDate,
      message: `Books are locked up to ${lockDate}. Only Master Admin can modify entries on or before this date.`,
    };
  }
  return { locked: false };
}

module.exports = {
  checkBooksLock,
  invalidateBooksLockCache,
  getBooksLockDate,
};
