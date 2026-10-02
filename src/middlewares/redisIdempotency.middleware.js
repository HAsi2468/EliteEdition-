/**
 * ============================================================================
 * ELITE ERP ENTERPRISE - DISTRIBUTED REDIS IDEMPOTENCY MIDDLEWARE
 * Prevents double clicks, network retries, and duplicate submissions
 * using atomic Redis SETNX locking and 24-hour response caching.
 * ============================================================================
 */

const { getRedisClient } = require('../db/redisClient');
const logger = require('../config/logger');

const LOCK_TTL_SECONDS = 60; // 60s lock during execution
const CACHE_TTL_SECONDS = 86400; // 24 hours cache for completed responses

/**
 * Creates Redis-backed idempotency middleware.
 * @param {object} [options={}]
 * @param {boolean} [options.required=false] - Whether the header is mandatory
 * @param {string} [options.action='TRANSACTION'] - Logical action context
 */
function redisIdempotencyMiddleware(options = {}) {
  const { required = false, action = 'TRANSACTION' } = options;

  return async (req, res, next) => {
    // Only intercept mutating HTTP methods
    const method = req.method.toUpperCase();
    if (!['POST', 'PUT', 'PATCH', 'DELETE'].includes(method)) {
      return next();
    }

    const rawKey = req.headers['idempotency-key'] || req.headers['x-idempotency-key'];

    if (!rawKey) {
      if (required) {
        return res.status(400).json({
          success: false,
          code: 'MISSING_IDEMPOTENCY_KEY',
          message: 'An Idempotency-Key header is required for this operation.'
        });
      }
      return next();
    }

    const idempotencyKey = String(rawKey).trim();
    if (idempotencyKey.length < 8 || idempotencyKey.length > 255) {
      return res.status(400).json({
        success: false,
        code: 'INVALID_IDEMPOTENCY_KEY',
        message: 'Idempotency-Key header must be between 8 and 255 characters.'
      });
    }

    const userId = req.user?._id || req.user?.id || req.userId || 'anonymous';
    const redisKey = `idempotency:${userId}:${idempotencyKey}`;
    const redis = getRedisClient();

    try {
      // ─────────────────────────────────────────────────────────────────────────
      // Step 1: Attempt atomic lock acquisition (SETNX with 60s TTL)
      // ─────────────────────────────────────────────────────────────────────────
      const acquireResult = await redis.set(redisKey, 'IN_PROGRESS', {
        NX: true,
        EX: LOCK_TTL_SECONDS
      });

      // If acquireResult is null, the key ALREADY existed in Redis
      if (!acquireResult) {
        const cachedRaw = await redis.get(redisKey);

        if (cachedRaw === 'IN_PROGRESS') {
          // Request is still executing in another worker/thread
          return res.status(409).json({
            success: false,
            code: 'REQUEST_IN_PROGRESS',
            status: 409,
            message: 'A request with this Idempotency-Key is currently processing. Please wait.'
          });
        }

        if (cachedRaw) {
          // Request previously completed — replay the cached response
          try {
            const cached = JSON.parse(cachedRaw);
            res.setHeader('Idempotent-Replayed', 'true');
            if (cached.headers) {
              for (const [hKey, hVal] of Object.entries(cached.headers)) {
                if (hKey.toLowerCase() !== 'transfer-encoding' && hKey.toLowerCase() !== 'content-length') {
                  res.setHeader(hKey, hVal);
                }
              }
            }
            return res.status(cached.statusCode || 200).send(cached.body);
          } catch (parseErr) {
            logger.warn('Failed to parse cached idempotency payload: %s', parseErr.message);
          }
        }
      }

      // ─────────────────────────────────────────────────────────────────────────
      // Step 2: Intercept response to serialize and cache upon completion
      // ─────────────────────────────────────────────────────────────────────────
      const originalSend = res.send;
      const originalJson = res.json;
      let capturedBody = null;

      res.send = function (body) {
        capturedBody = body;
        return originalSend.apply(res, arguments);
      };

      res.json = function (body) {
        capturedBody = body;
        return originalJson.apply(res, arguments);
      };

      res.on('finish', async () => {
        try {
          if (res.statusCode >= 500) {
            // Server error: release the lock so the client can retry
            await redis.del(redisKey);
          } else {
            // Successful / Client response: Cache with 24-hour TTL
            let serializedBody = capturedBody;
            if (typeof capturedBody === 'object' && capturedBody !== null && !Buffer.isBuffer(capturedBody)) {
              serializedBody = capturedBody;
            }

            const cachePayload = JSON.stringify({
              statusCode: res.statusCode,
              body: serializedBody,
              headers: {
                'content-type': res.getHeader('content-type') || 'application/json'
              },
              action,
              cachedAt: Date.now()
            });

            await redis.set(redisKey, cachePayload, { EX: CACHE_TTL_SECONDS });
          }
        } catch (saveErr) {
          logger.warn('Failed to persist response in idempotency cache: %s', saveErr.message);
        }
      });

      next();
    } catch (err) {
      logger.error('Redis Idempotency Middleware Error: %s', err.message);
      // In case of unexpected Redis infrastructure error, fail open to avoid halting business
      next();
    }
  };
}

module.exports = redisIdempotencyMiddleware;
