/**
 * Technical Specification: "Job Card & Lot Status Race Condition Engine" (Phase 3)
 * Multi-Entity Transaction Workflow Coordinating Job Card Completion, Atomic Lot Deduction,
 * and Ledger Recording with Strict Lock Ordering, Timeouts, and Deadlock Guards.
 */

const { getPgPool } = require('../../db/postgresClient');
const {
  VersionConflictError,
  InvalidStatusTransitionError,
  InsufficientMetersError,
  ResourceBusyError,
  DeadlockRetryExhaustedError,
  RecordNotFoundError
} = require('./errors');

// Valid statuses that can transition directly to 'COMPLETED'
const COMPLETION_ELIGIBLE_STATUSES = new Set(['DRAFT', 'IN_PROGRESS', 'ON_HOLD']);

/**
 * Calculates exponential backoff delay with randomized full jitter.
 * @param {number} attempt - Current retry attempt index (0-based)
 * @param {number} [baseMs=50] - Base delay in milliseconds
 * @param {number} [maxJitterMs=40] - Additional randomized jitter ceiling
 * @returns {number}
 */
function getJitteredBackoff(attempt, baseMs = 50, maxJitterMs = 40) {
  const exponentialDelay = baseMs * Math.pow(2, attempt);
  const jitter = Math.floor(Math.random() * maxJitterMs);
  return exponentialDelay + jitter;
}

/**
 * Sleeps for specified milliseconds.
 * @param {number} ms 
 * @returns {Promise<void>}
 */
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Single-attempt transaction execution executing the atomic completion workflow.
 * 
 * @param {object} client - Active node-postgres client inside an open transaction
 * @param {object} params
 * @param {string} params.jobCardId
 * @param {number} params.clientVersion
 * @param {string} params.lotId
 * @param {number} params.requestedMeters
 * @param {string} params.userId
 * @returns {Promise<object>}
 */
async function executeCompletionTransaction(client, {
  jobCardId,
  clientVersion,
  lotId,
  requestedMeters,
  userId
}) {
  // Enforce session-level lock wait timeout (3 seconds) to prevent cascading connection pool starvation
  await client.query("SET LOCAL lock_wait_timeout = '3s';");

  // ─────────────────────────────────────────────────────────────────────────────
  // STRICT LOCK ORDERING
  // Step 1: Acquire exclusive row lock on Job Card
  // ─────────────────────────────────────────────────────────────────────────────
  const jobCardQuery = `
    SELECT id, job_number, status, version, total_meters, created_by, updated_by
    FROM job_cards
    WHERE id = $1
    FOR UPDATE;
  `;
  const jobCardRes = await client.query(jobCardQuery, [jobCardId]);

  if (jobCardRes.rows.length === 0) {
    throw new RecordNotFoundError('Job Card', jobCardId);
  }

  const jobCard = jobCardRes.rows[0];

  // Step 2: Validate Authoritative Database State & Optimistic Version
  const serverVersion = Number(jobCard.version);
  const expectedVersion = Number(clientVersion);

  if (serverVersion !== expectedVersion) {
    throw new VersionConflictError({
      jobCardId,
      serverVersion,
      clientVersion: expectedVersion
    });
  }

  if (!COMPLETION_ELIGIBLE_STATUSES.has(jobCard.status)) {
    throw new InvalidStatusTransitionError({
      jobCardId,
      currentStatus: jobCard.status,
      targetStatus: 'COMPLETED'
    });
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // Step 3: Acquire exclusive row lock on Target Fabric Lot (Strict Order: Job Card -> Lot)
  // ─────────────────────────────────────────────────────────────────────────────
  const lotQuery = `
    SELECT id, lot_number, fabric_type, total_meters, available_meters, version, status
    FROM lots
    WHERE id = $1
    FOR UPDATE;
  `;
  const lotRes = await client.query(lotQuery, [lotId]);

  if (lotRes.rows.length === 0) {
    throw new RecordNotFoundError('Lot', lotId);
  }

  const lot = lotRes.rows[0];
  const currentAvailableMeters = Number(lot.available_meters);
  const metersToDeduct = Number(requestedMeters);

  if (isNaN(metersToDeduct) || metersToDeduct <= 0) {
    throw new Error(`Invalid requested meters: '${requestedMeters}'. Must be a positive decimal.`);
  }

  // Step 4: Verify Available Lot Inventory
  if (currentAvailableMeters < metersToDeduct) {
    throw new InsufficientMetersError({
      lotId,
      availableMeters: currentAvailableMeters,
      requestedMeters: metersToDeduct
    });
  }

  const newBalance = Number((currentAvailableMeters - metersToDeduct).toFixed(2));

  // ─────────────────────────────────────────────────────────────────────────────
  // Step 5: Atomic Writes
  // ─────────────────────────────────────────────────────────────────────────────

  // 5a. Decrement lot meters & increment lot version
  const updateLotQuery = `
    UPDATE lots
    SET available_meters = $1,
        version = version + 1,
        updated_at = NOW()
    WHERE id = $2 AND version = $3
    RETURNING id, lot_number, available_meters, version, updated_at;
  `;
  const updatedLotRes = await client.query(updateLotQuery, [newBalance, lotId, lot.version]);
  if (updatedLotRes.rows.length === 0) {
    throw new VersionConflictError({
      jobCardId: lotId,
      serverVersion: 'Concurrent Lot Modification',
      clientVersion: lot.version
    });
  }
  const updatedLot = updatedLotRes.rows[0];

  // 5b. Advance Job Card status to COMPLETED & increment version
  const updateJobCardQuery = `
    UPDATE job_cards
    SET status = 'COMPLETED',
        version = version + 1,
        updated_by = $1,
        updated_at = NOW()
    WHERE id = $2 AND version = $3
    RETURNING id, job_number, status, version, updated_by, updated_at;
  `;
  const updatedJobCardRes = await client.query(updateJobCardQuery, [
    userId || 'SYSTEM_OPERATOR',
    jobCardId,
    serverVersion
  ]);
  if (updatedJobCardRes.rows.length === 0) {
    throw new VersionConflictError({
      jobCardId,
      serverVersion: 'Concurrent Job Card Modification',
      clientVersion: serverVersion
    });
  }
  const updatedJobCard = updatedJobCardRes.rows[0];

  // 5c. Insert immutable audit ledger record
  const insertLedgerQuery = `
    INSERT INTO lot_ledger (
      lot_id,
      job_card_id,
      delta_meters,
      balance_after,
      transaction_type,
      created_by,
      created_at
    )
    VALUES ($1, $2, $3, $4, 'CONSUMPTION', $5, NOW())
    RETURNING id, lot_id, job_card_id, delta_meters, balance_after, transaction_type, created_at;
  `;
  const ledgerRes = await client.query(insertLedgerQuery, [
    lotId,
    jobCardId,
    -metersToDeduct,
    newBalance,
    userId || 'SYSTEM_OPERATOR'
  ]);
  const ledgerRecord = ledgerRes.rows[0];

  return {
    success: true,
    jobCard: updatedJobCard,
    lot: updatedLot,
    ledger: ledgerRecord,
    allocation: {
      metersAllocated: metersToDeduct,
      previousBalance: currentAvailableMeters,
      currentBalance: newBalance
    }
  };
}

/**
 * Multi-Entity Transaction Workflow Coordinator (`allocateAndCompleteJob`)
 * Wraps atomic execution with Deadlock ('40P01') auto-retry and Timeout ('55P03'/'57014') guards.
 * 
 * @param {object} params
 * @param {string} params.jobCardId
 * @param {number} params.clientVersion
 * @param {string} params.lotId
 * @param {number} params.requestedMeters
 * @param {string} params.userId
 * @param {number} [params.maxRetries=3]
 * @returns {Promise<object>}
 */
async function allocateAndCompleteJob({
  jobCardId,
  clientVersion,
  lotId,
  requestedMeters,
  userId,
  maxRetries = 3
}) {
  const pool = getPgPool();
  let attempt = 0;

  while (attempt <= maxRetries) {
    const client = await pool.connect();

    try {
      await client.query('BEGIN');

      const outcome = await executeCompletionTransaction(client, {
        jobCardId,
        clientVersion,
        lotId,
        requestedMeters,
        userId
      });

      await client.query('COMMIT');
      return outcome;

    } catch (err) {
      try {
        await client.query('ROLLBACK');
      } catch (rollbackErr) {
        // Suppress rollback errors if connection was already closed
      }

      // Check PostgreSQL Error Codes
      const pgCode = err.code;

      // 1. Timeout / Lock Not Available Guard
      // 55P03: lock_not_available
      // 57014: query_canceled (raised by Postgres statement_timeout or lock_wait_timeout)
      if (pgCode === '55P03' || pgCode === '57014') {
        throw new ResourceBusyError({
          message: 'The requested Job Card or Fabric Lot is currently locked by a concurrent transaction. Please retry shortly.',
          originalError: err
        });
      }

      // 2. Deadlock Guard with Randomized Exponential Jitter Retry
      // 40P01: deadlock_detected
      if (pgCode === '40P01') {
        attempt++;
        if (attempt <= maxRetries) {
          const backoffDelay = getJitteredBackoff(attempt);
          console.warn(`[Deadlock Detected (40P01)] Retrying transaction for JobCard ${jobCardId} and Lot ${lotId}. Attempt ${attempt}/${maxRetries} after ${backoffDelay}ms.`);
          await sleep(backoffDelay);
          continue;
        } else {
          throw new DeadlockRetryExhaustedError({
            retries: maxRetries,
            originalError: err
          });
        }
      }

      // Pass domain/validation/OCC errors directly to upper layer
      throw err;

    } finally {
      client.release();
    }
  }
}

module.exports = {
  allocateAndCompleteJob,
  executeCompletionTransaction,
  getJitteredBackoff
};
