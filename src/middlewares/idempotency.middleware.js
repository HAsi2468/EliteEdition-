/**
 * Technical Specification: "Job Card & Lot Status Race Condition Engine" (Phase 3)
 * Distributed Idempotency Protection Middleware
 * 
 * Features:
 * - Deterministic SHA-256 payload hashing
 * - Atomic key lock acquisition via PostgreSQL ON CONFLICT DO NOTHING
 * - IN_PROGRESS lock contention protection (409 Conflict)
 * - Safe response replay with 'Idempotent-Replayed: true' header
 * - Payload mismatch detection (422 Unprocessable Entity)
 * - Defensive 5xx failure cleanup (releases locks on server crashes)
 */

const crypto = require('crypto');
const { getPgPool } = require('../db/postgresClient');

/**
 * Produces a deterministic canonical string representation of an object regardless of key order.
 * @param {any} obj 
 * @returns {string}
 */
function canonicalizeJson(obj) {
  if (obj === null || typeof obj !== 'object') {
    return JSON.stringify(obj);
  }
  if (Array.isArray(obj)) {
    return '[' + obj.map(canonicalizeJson).join(',') + ']';
  }
  const keys = Object.keys(obj).sort();
  return '{' + keys.map((k) => JSON.stringify(k) + ':' + canonicalizeJson(obj[k])).join(',') + '}';
}

/**
 * Computes SHA-256 hash of request body and query parameters.
 * @param {object} req 
 * @returns {string}
 */
function computeRequestHash(req) {
  const canonicalBody = canonicalizeJson(req.body || {});
  const canonicalQuery = canonicalizeJson(req.query || {});
  return crypto.createHash('sha256').update(`${canonicalBody}|${canonicalQuery}`).digest('hex');
}

/**
 * Creates the Idempotency Middleware configured for specific actions.
 * 
 * @param {object} [options={}]
 * @param {string} [options.action='DEFAULT_ACTION'] - Identifier for the logical action being performed
 * @param {boolean} [options.required=true] - Whether the Idempotency-Key header is strictly mandatory
 */
function idempotencyMiddleware(options = {}) {
  const { action = 'DEFAULT_ACTION', required = true } = options;

  return async (req, res, next) => {
    const rawKey = req.headers['idempotency-key'] || req.headers['x-idempotency-key'];

    if (!rawKey) {
      if (required) {
        return res.status(400).json({
          type: 'https://api.eliteedition.in/errors/MISSING_IDEMPOTENCY_KEY',
          title: 'Missing Idempotency-Key Header',
          status: 400,
          code: 'MISSING_IDEMPOTENCY_KEY',
          detail: "An 'Idempotency-Key' header is required for this transactional mutation.",
          instance: req.originalUrl
        });
      }
      return next();
    }

    const idempotencyKey = String(rawKey).trim();
    if (idempotencyKey.length < 8 || idempotencyKey.length > 255) {
      return res.status(400).json({
        type: 'https://api.eliteedition.in/errors/INVALID_IDEMPOTENCY_KEY',
        title: 'Invalid Idempotency-Key',
        status: 400,
        code: 'INVALID_IDEMPOTENCY_KEY',
        detail: 'Idempotency-Key header must be between 8 and 255 characters.',
        instance: req.originalUrl
      });
    }

    const requestHash = computeRequestHash(req);
    const userId = req.user?.id || req.user?._id || 'ANONYMOUS_USER';
    const pool = getPgPool();

    try {
      // ─────────────────────────────────────────────────────────────────────────────
      // Atomically claim the idempotency key with status 'IN_PROGRESS'
      // ─────────────────────────────────────────────────────────────────────────────
      const claimQuery = `
        INSERT INTO idempotency_keys (
          key,
          user_id,
          action,
          request_hash,
          status,
          created_at,
          updated_at
        )
        VALUES ($1, $2, $3, $4, 'IN_PROGRESS', NOW(), NOW())
        ON CONFLICT (key) DO NOTHING
        RETURNING key;
      `;
      const claimRes = await pool.query(claimQuery, [
        idempotencyKey,
        String(userId),
        action,
        requestHash
      ]);

      // Conflict: Key was already present in database
      if (claimRes.rows.length === 0) {
        const lookupQuery = `
          SELECT key, user_id, action, request_hash, status, response_status, response_body
          FROM idempotency_keys
          WHERE key = $1;
        `;
        const lookupRes = await pool.query(lookupQuery, [idempotencyKey]);

        if (lookupRes.rows.length === 0) {
          // Rare race condition: row was deleted immediately after conflict. Retry next tick.
          return res.status(409).json({
            type: 'https://api.eliteedition.in/errors/CONFLICT',
            title: 'Conflict',
            status: 409,
            code: 'CONFLICT',
            detail: 'Concurrent request conflict detected on idempotency lock. Please retry.',
            instance: req.originalUrl
          });
        }

        const existingRecord = lookupRes.rows[0];

        // Case A: Prior request is still processing
        if (existingRecord.status === 'IN_PROGRESS') {
          return res.status(409).json({
            type: 'https://api.eliteedition.in/errors/CONCURRENT_REQUEST',
            title: 'Request Already In Progress',
            status: 409,
            code: 'CONFLICT',
            detail: `A concurrent request with Idempotency-Key '${idempotencyKey}' is actively processing. Please await completion before submitting retries.`,
            instance: req.originalUrl
          });
        }

        // Case B: Prior request completed -> Validate Payload Hash
        if (existingRecord.status === 'COMPLETED') {
          if (existingRecord.request_hash !== requestHash) {
            return res.status(422).json({
              type: 'https://api.eliteedition.in/errors/PAYLOAD_MISMATCH',
              title: 'Idempotency Payload Mismatch',
              status: 422,
              code: 'PAYLOAD_MISMATCH',
              detail: `Idempotency-Key '${idempotencyKey}' was previously executed with a different request payload. Reusing keys across differing payloads is strictly prohibited.`,
              instance: req.originalUrl
            });
          }

          // Hash matches: Safely replay cached response
          res.setHeader('Idempotent-Replayed', 'true');
          const cachedStatus = existingRecord.response_status || 200;
          return res.status(cachedStatus).json(existingRecord.response_body);
        }
      }

      // ─────────────────────────────────────────────────────────────────────────────
      // Key claimed successfully. Intercept response to store result or release on 5xx.
      // ─────────────────────────────────────────────────────────────────────────────
      const originalJson = res.json.bind(res);
      const originalSend = res.send.bind(res);

      let responseSent = false;
      let finalResponseBody = null;

      res.json = function (body) {
        finalResponseBody = body;
        return originalJson(body);
      };

      res.send = function (body) {
        if (!finalResponseBody) {
          try {
            finalResponseBody = typeof body === 'string' ? JSON.parse(body) : body;
          } catch (e) {
            finalResponseBody = { message: String(body) };
          }
        }
        return originalSend(body);
      };

      res.on('finish', async () => {
        if (responseSent) return;
        responseSent = true;

        const statusCode = res.statusCode;

        try {
          if (statusCode >= 500) {
            // Directive: On 5xx failure/server crash: delete the key lock so legitimate retries are not blocked
            await pool.query('DELETE FROM idempotency_keys WHERE key = $1;', [idempotencyKey]);
          } else {
            // Directive: On success: update key with status code, response body, and status 'COMPLETED'
            const updateKeyQuery = `
              UPDATE idempotency_keys
              SET status = 'COMPLETED',
                  response_status = $1,
                  response_body = $2::jsonb,
                  updated_at = NOW()
              WHERE key = $3;
            `;
            await pool.query(updateKeyQuery, [
              statusCode,
              JSON.stringify(finalResponseBody || {}),
              idempotencyKey
            ]);
          }
        } catch (dbErr) {
          console.error(`[Idempotency Finalizer Error for Key '${idempotencyKey}']`, dbErr);
        }
      });

      next();

    } catch (err) {
      console.error('[Idempotency Middleware Error]:', err);
      return res.status(500).json({
        type: 'https://api.eliteedition.in/errors/IDEMPOTENCY_SUBSYSTEM_ERROR',
        title: 'Idempotency Subsystem Failure',
        status: 500,
        code: 'INTERNAL_ERROR',
        detail: 'An unexpected error occurred while claiming idempotency lock.',
        instance: req.originalUrl
      });
    }
  };
}

module.exports = {
  idempotencyMiddleware,
  computeRequestHash,
  canonicalizeJson
};
