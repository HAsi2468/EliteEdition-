/**
 * Automated Verification Suite for Job Card & Lot Status Race Condition Engine (Phase 3)
 * Tests multi-step atomic transaction, lock ordering, deadlock guards, and idempotency protection.
 */

const assert = require('assert');
const {
  allocateAndCompleteJob,
  executeCompletionTransaction,
  getJitteredBackoff
} = require('../services/raceConditionEngine/jobCardCompletionEngine');
const {
  VersionConflictError,
  InvalidStatusTransitionError,
  InsufficientMetersError,
  ResourceBusyError,
  DeadlockRetryExhaustedError,
  RecordNotFoundError
} = require('../services/raceConditionEngine/errors');
const {
  computeRequestHash,
  canonicalizeJson
} = require('../middlewares/idempotency.middleware');

async function runTestSuite() {
  console.log('================================================================');
  console.log('🧪 RUNNING PHASE 3 RACE CONDITION ENGINE CONCURRENCY TEST SUITE');
  console.log('================================================================');

  let passed = 0;
  let failed = 0;

  function test(name, fn) {
    try {
      fn();
      console.log(`  ✅ PASS: ${name}`);
      passed++;
    } catch (e) {
      console.error(`  ❌ FAIL: ${name}`, e);
      failed++;
    }
  }

  async function testAsync(name, fn) {
    try {
      await fn();
      console.log(`  ✅ PASS: ${name}`);
      passed++;
    } catch (e) {
      console.error(`  ❌ FAIL: ${name}`, e);
      failed++;
    }
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // 1. Lock Ordering & Happy Path Verification
  // ─────────────────────────────────────────────────────────────────────────────
  await testAsync('1. Happy Path: Completes Job Card, decrements lot, and records ledger in strict order', async () => {
    const executedQueries = [];

    const mockClient = {
      query: async (text, params) => {
        executedQueries.push({ text: text.trim(), params });

        // SET LOCAL lock_wait_timeout
        if (text.includes('lock_wait_timeout')) {
          return { rows: [] };
        }

        // Step 1: SELECT job_card FOR UPDATE
        if (text.includes('FROM job_cards') && text.includes('FOR UPDATE')) {
          return {
            rows: [{
              id: 'JC-100',
              job_number: 'JOB-2026-100',
              status: 'IN_PROGRESS',
              version: 3,
              total_meters: 500.00
            }]
          };
        }

        // Step 3: SELECT lot FOR UPDATE
        if (text.includes('FROM lots') && text.includes('FOR UPDATE')) {
          return {
            rows: [{
              id: 'LOT-500',
              lot_number: 'L-COTTON-500',
              fabric_type: 'Cotton 60s',
              available_meters: 1000.00,
              version: 1,
              status: 'AVAILABLE'
            }]
          };
        }

        // Step 5a: UPDATE lots
        if (text.includes('UPDATE lots')) {
          return {
            rows: [{
              id: 'LOT-500',
              lot_number: 'L-COTTON-500',
              available_meters: 850.00,
              version: 2
            }]
          };
        }

        // Step 5b: UPDATE job_cards
        if (text.includes('UPDATE job_cards')) {
          return {
            rows: [{
              id: 'JC-100',
              job_number: 'JOB-2026-100',
              status: 'COMPLETED',
              version: 4
            }]
          };
        }

        // Step 5c: INSERT lot_ledger
        if (text.includes('INSERT INTO lot_ledger')) {
          return {
            rows: [{
              id: '1',
              lot_id: 'LOT-500',
              job_card_id: 'JC-100',
              delta_meters: -150.00,
              balance_after: 850.00,
              transaction_type: 'CONSUMPTION'
            }]
          };
        }

        return { rows: [] };
      }
    };

    const result = await executeCompletionTransaction(mockClient, {
      jobCardId: 'JC-100',
      clientVersion: 3,
      lotId: 'LOT-500',
      requestedMeters: 150.00,
      userId: 'USER-1'
    });

    assert.strictEqual(result.success, true);
    assert.strictEqual(result.jobCard.status, 'COMPLETED');
    assert.strictEqual(result.jobCard.version, 4);
    assert.strictEqual(result.lot.available_meters, 850.00);
    assert.strictEqual(result.ledger.delta_meters, -150.00);

    // Verify Strict Lock Ordering
    const firstLock = executedQueries.findIndex(q => q.text.includes('job_cards') && q.text.includes('FOR UPDATE'));
    const secondLock = executedQueries.findIndex(q => q.text.includes('lots') && q.text.includes('FOR UPDATE'));
    assert.ok(firstLock !== -1, 'Job card lock must be queried');
    assert.ok(secondLock !== -1, 'Lot lock must be queried');
    assert.ok(firstLock < secondLock, 'Job card lock must precede Lot lock (Strict ordering)');
  });

  // ─────────────────────────────────────────────────────────────────────────────
  // 2. Concurrency Conflict Guard (409)
  // ─────────────────────────────────────────────────────────────────────────────
  await testAsync('2. Version Conflict Guard: Rejects stale client version with 409', async () => {
    const mockClient = {
      query: async (text) => {
        if (text.includes('lock_wait_timeout')) return { rows: [] };
        if (text.includes('FROM job_cards')) {
          return {
            rows: [{
              id: 'JC-100',
              job_number: 'JOB-2026-100',
              status: 'IN_PROGRESS',
              version: 5 // Database version advanced
            }]
          };
        }
        return { rows: [] };
      }
    };

    try {
      await executeCompletionTransaction(mockClient, {
        jobCardId: 'JC-100',
        clientVersion: 4, // Stale client version
        lotId: 'LOT-500',
        requestedMeters: 100,
        userId: 'USER-1'
      });
      assert.fail('Should have thrown VersionConflictError');
    } catch (e) {
      assert.ok(e instanceof VersionConflictError);
      assert.strictEqual(e.status, 409);
      assert.strictEqual(e.code, 'VERSION_CONFLICT');
    }
  });

  // ─────────────────────────────────────────────────────────────────────────────
  // 3. State Machine Guard (409)
  // ─────────────────────────────────────────────────────────────────────────────
  await testAsync('3. State Machine Guard: Rejects completion of already COMPLETED job card with 409', async () => {
    const mockClient = {
      query: async (text) => {
        if (text.includes('lock_wait_timeout')) return { rows: [] };
        if (text.includes('FROM job_cards')) {
          return {
            rows: [{
              id: 'JC-100',
              status: 'COMPLETED',
              version: 2
            }]
          };
        }
        return { rows: [] };
      }
    };

    try {
      await executeCompletionTransaction(mockClient, {
        jobCardId: 'JC-100',
        clientVersion: 2,
        lotId: 'LOT-500',
        requestedMeters: 100,
        userId: 'USER-1'
      });
      assert.fail('Should have thrown InvalidStatusTransitionError');
    } catch (e) {
      assert.ok(e instanceof InvalidStatusTransitionError);
      assert.strictEqual(e.status, 409);
      assert.strictEqual(e.code, 'INVALID_TRANSITION');
    }
  });

  // ─────────────────────────────────────────────────────────────────────────────
  // 4. Insufficient Meters Guard (422)
  // ─────────────────────────────────────────────────────────────────────────────
  await testAsync('4. Inventory Balance Guard: Rejects deduction exceeding available meters with 422', async () => {
    const mockClient = {
      query: async (text) => {
        if (text.includes('lock_wait_timeout')) return { rows: [] };
        if (text.includes('FROM job_cards')) {
          return { rows: [{ id: 'JC-100', status: 'IN_PROGRESS', version: 1 }] };
        }
        if (text.includes('FROM lots')) {
          return { rows: [{ id: 'LOT-500', available_meters: 50.00, version: 1 }] };
        }
        return { rows: [] };
      }
    };

    try {
      await executeCompletionTransaction(mockClient, {
        jobCardId: 'JC-100',
        clientVersion: 1,
        lotId: 'LOT-500',
        requestedMeters: 120.00, // 120m requested > 50m available
        userId: 'USER-1'
      });
      assert.fail('Should have thrown InsufficientMetersError');
    } catch (e) {
      assert.ok(e instanceof InsufficientMetersError);
      assert.strictEqual(e.status, 422);
      assert.strictEqual(e.code, 'INSUFFICIENT_METERS');
      assert.strictEqual(e.metadata.shortage, 70.00);
    }
  });

  // ─────────────────────────────────────────────────────────────────────────────
  // 5. Randomized Jitter Calculation
  // ─────────────────────────────────────────────────────────────────────────────
  test('5. Deadlock Jitter: Generates positive exponential backoff with random variance', () => {
    const delay0 = getJitteredBackoff(0, 50, 20);
    const delay1 = getJitteredBackoff(1, 50, 20);
    const delay2 = getJitteredBackoff(2, 50, 20);

    assert.ok(delay0 >= 50 && delay0 <= 70, `Attempt 0 delay ${delay0} out of bounds`);
    assert.ok(delay1 >= 100 && delay1 <= 120, `Attempt 1 delay ${delay1} out of bounds`);
    assert.ok(delay2 >= 200 && delay2 <= 220, `Attempt 2 delay ${delay2} out of bounds`);
  });

  // ─────────────────────────────────────────────────────────────────────────────
  // 6. Idempotency Deterministic Hash Verification
  // ─────────────────────────────────────────────────────────────────────────────
  test('6. Idempotency Canonical Hashing: Equivalent JSON with differing key orders produce identical hash', () => {
    const req1 = {
      body: { b: 2, a: 1, z: { d: 4, c: 3 } },
      query: { page: '1', sort: 'desc' }
    };

    const req2 = {
      body: { z: { c: 3, d: 4 }, a: 1, b: 2 },
      query: { sort: 'desc', page: '1' }
    };

    const hash1 = computeRequestHash(req1);
    const hash2 = computeRequestHash(req2);

    assert.strictEqual(hash1, hash2, 'Hashes of identical payloads must match regardless of key order');
    assert.strictEqual(hash1.length, 64, 'SHA-256 hash must be 64 hexadecimal characters');
  });

  console.log('================================================================');
  console.log(`Results: ${passed} Passed, ${failed} Failed`);
  console.log('================================================================');

  if (failed > 0) {
    process.exit(1);
  }
}

runTestSuite().catch((err) => {
  console.error('Test runner fatal error:', err);
  process.exit(1);
});
