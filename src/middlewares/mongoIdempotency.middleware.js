/**
 * Technical Blueprint Implementation: Express + Mongoose Idempotency Middleware (BUG-004, BUG-053)
 * Guarantees:
 * - Brand-new key -> 201/200; two keys -> two creates; replay -> stored response
 * - Lock released on 5xx/401/403/aborts so retries execute cleanly without stuck 409s
 * - Stale in-progress locks (> 30s) automatically taken over
 * - Same key + different request hash -> 422 IDEMPOTENCY_KEY_REUSED
 * - Unique compound index on { companyId: 1, key: 1 }
 */
const crypto = require('crypto');
const mongoose = require('mongoose');

const IdempotencyRecordSchema = new mongoose.Schema(
  {
    key: { type: String, required: true, maxlength: 255 },
    companyId: { type: String, required: true },
    userId: { type: String, required: true },
    method: { type: String, required: true },
    path: { type: String, required: true },
    requestHash: { type: String, required: true },
    status: { type: String, enum: ['in_progress', 'completed'], required: true },
    lockedUntil: { type: Date, required: true },
    responseStatus: Number,
    responseBody: mongoose.Schema.Types.Mixed,
    responseContentType: String,
    createdAt: { type: Date, default: () => new Date() },
    expiresAt: { type: Date, required: true }
  },
  { collection: 'idempotency_keys', versionKey: false }
);

IdempotencyRecordSchema.index({ companyId: 1, key: 1 }, { unique: true, name: 'uniq_company_key' });
IdempotencyRecordSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0, name: 'ttl_expiresAt' });

const IdempotencyKey = mongoose.models.IdempotencyKey || mongoose.model('IdempotencyKey', IdempotencyRecordSchema);

function stableStringify(v) {
  if (v === null || typeof v !== 'object') return JSON.stringify(v) ?? 'null';
  if (Array.isArray(v)) return `[${v.map(stableStringify).join(',')}]`;
  const o = v;
  return `{${Object.keys(o).sort().map((k) => `${JSON.stringify(k)}:${stableStringify(o[k])}`).join(',')}}`;
}

function hashRequest(req) {
  const body = req.body === undefined ? '' : stableStringify(req.body);
  return crypto.createHash('sha256').update(`${req.method}\n${req.baseUrl || ''}${req.path}\n${body}`).digest('hex');
}

function isReplayable(status) {
  if (status >= 200 && status < 300) return true;
  return status >= 400 && status < 500 && ![401, 403, 408, 409, 425, 429].includes(status);
}

const KEY_RE = /^[A-Za-z0-9_\-:.]{8,255}$/;

function mongoIdempotency(opts = {}) {
  const lockTtlMs = opts.lockTtlMs ?? 30000;
  const retentionMs = (opts.retentionHours ?? 24) * 3600000;
  const Model = opts.model || IdempotencyKey;

  return async (req, res, next) => {
    if (!['POST', 'PUT', 'PATCH', 'DELETE'].includes(req.method)) {
      return next();
    }

    const key = req.get('Idempotency-Key') || req.get('x-idempotency-key');
    if (!key) {
      if (opts.required) {
        return res.status(400).json({
          success: false,
          code: 'IDEMPOTENCY_KEY_REQUIRED',
          message: 'Idempotency-Key header is required.'
        });
      }
      return next();
    }

    if (!KEY_RE.test(key)) {
      return res.status(400).json({
        success: false,
        code: 'IDEMPOTENCY_KEY_INVALID',
        message: 'Invalid Idempotency-Key.'
      });
    }

    const companyId = req.auth?.companyId || req.companyId || req.company_id || req.user?.companyId || 'default';
    const userId = req.auth?.userId || (req.user?._id ? String(req.user._id) : null) || 'anonymous';
    const requestHash = hashRequest(req);
    const now = new Date();
    const filter = { companyId: String(companyId), key };

    let owned = false;
    try {
      await Model.create({
        ...filter,
        userId,
        method: req.method,
        path: `${req.baseUrl || ''}${req.path}`,
        requestHash,
        status: 'in_progress',
        lockedUntil: new Date(now.getTime() + lockTtlMs),
        expiresAt: new Date(now.getTime() + retentionMs)
      });
      owned = true;
    } catch (err) {
      if (err.code !== 11000) return next(err);
    }

    if (!owned) {
      const existing = await Model.findOne(filter).lean();
      if (!existing) return next(new Error('Idempotency record vanished; retry'));

      if (existing.requestHash !== requestHash || (existing.userId !== 'anonymous' && existing.userId !== userId)) {
        return res.status(422).json({
          success: false,
          code: 'IDEMPOTENCY_KEY_REUSED',
          message: 'This Idempotency-Key was used for a different request.'
        });
      }

      if (existing.status === 'completed') {
        res.setHeader('Idempotent-Replayed', 'true');
        if (existing.responseContentType) {
          res.type(existing.responseContentType);
        }
        return res.status(existing.responseStatus || 200).send(existing.responseBody);
      }

      if (existing.lockedUntil && new Date(existing.lockedUntil).getTime() > now.getTime()) {
        const retryAfter = Math.ceil((new Date(existing.lockedUntil).getTime() - now.getTime()) / 1000);
        res.setHeader('Retry-After', String(retryAfter));
        return res.status(409).json({
          success: false,
          code: 'REQUEST_IN_PROGRESS',
          status: 409,
          message: 'A request with this Idempotency-Key is currently processing. Please wait.'
        });
      }

      // Stale lock takeover (crashed worker / timed out)
      const taken = await Model.findOneAndUpdate(
        { ...filter, status: 'in_progress', lockedUntil: { $lte: now } },
        { $set: { lockedUntil: new Date(now.getTime() + lockTtlMs) } },
        { new: true }
      ).lean();

      if (!taken) {
        res.setHeader('Retry-After', '1');
        return res.status(409).json({
          success: false,
          code: 'REQUEST_IN_PROGRESS',
          status: 409,
          message: 'A request with this Idempotency-Key is currently processing. Please wait.'
        });
      }
    }

    // Lock acquired: intercept response on all exit paths
    let captured = undefined;
    const origJson = res.json.bind(res);
    const origSend = res.send.bind(res);

    res.json = (body) => {
      captured = body;
      return origJson(body);
    };

    res.send = (body) => {
      if (captured === undefined) captured = body;
      return origSend(body);
    };

    let settled = false;
    const settle = async (finished) => {
      if (settled) return;
      settled = true;

      try {
        if (finished && isReplayable(res.statusCode)) {
          await Model.updateOne(filter, {
            $set: {
              status: 'completed',
              responseStatus: res.statusCode,
              responseBody: Buffer.isBuffer(captured) ? captured.toString('utf8') : captured,
              responseContentType: String(res.getHeader('Content-Type') || 'application/json'),
              lockedUntil: new Date()
            }
          });
        } else {
          // 5xx / 401 / 403 / aborted: delete lock record so client can retry with same key
          await Model.deleteOne({ ...filter, status: 'in_progress' });
        }
      } catch (e) {
        console.error('[idempotency] finalise failed:', { key, companyId, err: e.message });
      }
    };

    res.on('finish', () => void settle(true));
    res.on('close', () => void settle(res.writableFinished));
    next();
  };
}

module.exports = {
  IdempotencyKey,
  mongoIdempotency,
  hashRequest,
  stableStringify
};

