/**
 * Optimistic Concurrency Control (OCC) Middleware
 * Prevents race conditions and accidental overwrites when multiple users
 * edit the same record simultaneously across sister companies.
 */

function checkOptimisticConcurrency(existingDoc, clientVersionOrObj, clientUpdatedAt) {
  if (!existingDoc) return { conflict: false };

  let clientVersion;
  let clientUpdated;

  if (typeof clientVersionOrObj === 'object' && clientVersionOrObj !== null) {
    clientVersion = clientVersionOrObj.version ?? clientVersionOrObj._version;
    clientUpdated = clientVersionOrObj.lastKnownUpdatedAt ?? clientVersionOrObj.updatedAt ?? clientVersionOrObj.lastUpdatedAt;
  } else {
    clientVersion = clientVersionOrObj;
    clientUpdated = clientUpdatedAt;
  }

  const serverVersion = existingDoc.version ?? existingDoc.__v;
  const serverUpdatedAt = existingDoc.updatedAt || existingDoc.modified_date_time;

  // 1. Version check (__v or version)
  if (clientVersion !== undefined && clientVersion !== null) {
    const cVer = Number(clientVersion);
    if (!isNaN(cVer) && serverVersion !== undefined && serverVersion > cVer) {
      const err = new Error('This record was modified by another user');
      err.statusCode = 409;
      err.conflict = true;
      err.code = 'STALE_RECORD_CONFLICT';
      err.error = 'This record was modified by another user';
      err.serverVersion = serverVersion;
      err.serverUpdatedAt = serverUpdatedAt;
      return err;
    }
  }

  // 2. Timestamp check (updatedAt)
  if (clientUpdated) {
    const clientTime = new Date(clientUpdated).getTime();
    const serverTime = serverUpdatedAt ? new Date(serverUpdatedAt).getTime() : 0;
    // Allow 1 second tolerance for clock skew
    if (serverTime - clientTime > 1000) {
      const err = new Error('This record was modified by another user');
      err.statusCode = 409;
      err.conflict = true;
      err.code = 'STALE_RECORD_CONFLICT';
      err.error = 'This record was modified by another user';
      err.serverVersion = serverVersion;
      err.serverUpdatedAt = serverUpdatedAt;
      return err;
    }
  }

  return { conflict: false };
}

/**
 * Express middleware for checking concurrency header or body
 */
function concurrencyMiddleware(model) {
  return async (req, res, next) => {
    try {
      const id = req.params.id;
      if (!id || (req.method !== 'PUT' && req.method !== 'PATCH')) {
        return next();
      }

      const clientVersion = req.headers['if-match-version'] || req.body?._version || req.body?.version;
      const clientUpdatedAt = req.headers['if-unmodified-since'] || req.body?.updatedAt || req.body?.lastUpdatedAt;

      if (clientVersion === undefined && !clientUpdatedAt) {
        return next();
      }

      const existingDoc = await model.findById(id).select('__v version updatedAt modified_date_time').lean();
      if (!existingDoc) {
        return next();
      }

      const check = checkOptimisticConcurrency(existingDoc, clientVersion, clientUpdatedAt);
      if (check.conflict) {
        return res.status(409).json({
          status: 'error',
          code: 'STALE_RECORD_CONFLICT',
          message: 'This record was changed by another user. Please reload the latest version before submitting.',
          serverVersion: check.serverVersion,
          serverUpdatedAt: check.serverUpdatedAt
        });
      }

      next();
    } catch (err) {
      next(err);
    }
  };
}

module.exports = {
  checkOptimisticConcurrency,
  concurrencyMiddleware
};
