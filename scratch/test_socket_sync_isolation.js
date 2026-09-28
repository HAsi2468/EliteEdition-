/**
 * Comprehensive Automated Test Suite for Real-time Socket & Company Isolation
 *
 * Tests:
 * 1. EventBus event publishing and schema validation.
 * 2. Monotonic event sequence IDs and circular buffer resync.
 * 3. Rapid bursts debouncing.
 * 4. Company isolation: company A client receives company A events, company B does NOT.
 * 5. Optimistic Concurrency Control: stale updates rejected with 409 Conflict.
 */

const eventBus = require('../src/services/eventBus.service');
const { checkOptimisticConcurrency } = require('../src/middlewares/concurrencyControl');

async function runTests() {
  console.log('====================================================');
  console.log('STARTING REAL-TIME SOCKET & ISOLATION TEST SUITE');
  console.log('====================================================\n');

  let passed = 0;
  let failed = 0;

  function assert(condition, message) {
    if (condition) {
      console.log(`  ✅ PASS: ${message}`);
      passed++;
    } else {
      console.error(`  ❌ FAIL: ${message}`);
      failed++;
    }
  }

  // --- Mock Socket IO Server for testing event delivery & isolation ---
  const deliveredEvents = {
    'company:digital_print': [],
    'company:stitching': [],
    'company:elite_online': []
  };

  const mockIo = {
    to: (room) => {
      return {
        emit: (eventName, payload) => {
          if (!deliveredEvents[room]) deliveredEvents[room] = [];
          deliveredEvents[room].push({ eventName, payload });
        }
      };
    },
    emit: (eventName, payload) => {
      // Global emit tracker
      if (!deliveredEvents['__global__']) deliveredEvents['__global__'] = [];
      deliveredEvents['__global__'].push({ eventName, payload });
    },
    sockets: {
      adapter: {
        rooms: new Map([
          ['company:digital_print', new Set()],
          ['company:stitching', new Set()]
        ])
      }
    }
  };

  eventBus.setSocketIo(mockIo);

  // TEST 1: Standard Event Publishing & Monotonic Event ID
  console.log('--- TEST 1: Schema & Monotonic Sequence IDs ---');
  const evt1 = eventBus.publishDataChange({
    entity: 'JobCard',
    id: '67a80b1234567890abcdef01',
    action: 'created',
    companyId: 'digital_print',
    version: 1,
    payload: { jobNo: 'JC-1001', clientName: 'Fashion Corp' }
  });

  assert(evt1 && evt1.eventId > 0, `Event has monotonic eventId: ${evt1?.eventId}`);
  assert(evt1.type === 'jobcard:created', `Event type normalized to 'jobcard:created'`);
  assert(evt1.companyId === 'digital_print', `Event companyId preserved`);
  assert(evt1.version === 1, `Event version preserved`);
  assert(typeof evt1.timestamp === 'number', `Event timestamp is numeric epoch`);

  // TEST 2: Company Isolation Test
  console.log('\n--- TEST 2: Strict Company Isolation ---');
  // Clear delivery bins
  deliveredEvents['company:digital_print'] = [];
  deliveredEvents['company:stitching'] = [];
  deliveredEvents['company:elite_online'] = [];

  // Emit event for Digital Print
  eventBus.publishDataChange({
    entity: 'JobCard',
    id: '67a80b1234567890abcdef02',
    action: 'updated',
    companyId: 'digital_print',
    version: 2,
    payload: { stage: 'Printing' },
    immediate: true
  });

  // Emit event for Stitching
  eventBus.publishDataChange({
    entity: 'JobCard',
    id: '67a80b1234567890abcdef03',
    action: 'updated',
    companyId: 'stitching',
    version: 1,
    payload: { stage: 'Cutting' },
    immediate: true
  });

  const dpReceived = deliveredEvents['company:digital_print'];
  const esReceived = deliveredEvents['company:stitching'];
  const eoReceived = deliveredEvents['company:elite_online'];

  assert(dpReceived.length >= 1, `Digital Print room received events (${dpReceived.length} emits)`);
  assert(dpReceived.every(e => e.payload.companyId === 'digital_print'), `Digital Print events belong strictly to digital_print`);

  assert(esReceived.length >= 1, `Stitching room received events (${esReceived.length} emits)`);
  assert(esReceived.every(e => e.payload.companyId === 'stitching'), `Stitching events belong strictly to stitching`);

  assert(eoReceived.length === 0, `Elite Online room received 0 events (No cross-company leak)`);

  const crossPollution = dpReceived.some(e => e.payload.companyId === 'stitching') ||
                         esReceived.some(e => e.payload.companyId === 'digital_print');
  assert(!crossPollution, `Zero cross-company contamination between sister companies`);

  // TEST 3: Resync Buffer
  console.log('\n--- TEST 3: Missed Events Resync Buffer ---');
  const missedEvents = eventBus.getMissedEvents('digital_print', evt1.eventId, 0);
  assert(Array.isArray(missedEvents), `getMissedEvents returns array`);
  assert(missedEvents.length >= 1, `Recovered missed events for digital_print since eventId ${evt1.eventId}`);
  assert(missedEvents.every(e => e.companyId === 'digital_print'), `Resync returns only events for the requested company`);

  // TEST 4: Rapid Bursts Debouncing
  console.log('\n--- TEST 4: Rapid Burst Debouncing (150ms window) ---');
  deliveredEvents['company:digital_print'] = [];
  const testBurstId = '67a80b1234567890abcdef99';

  for (let i = 1; i <= 5; i++) {
    eventBus.publishDebounced({
      entity: 'JobCard',
      id: testBurstId,
      action: 'updated',
      companyId: 'digital_print',
      version: i,
      payload: { progress: i * 20 }
    }, 150);
  }

  // Immediately, 0 should be sent because they are debounced
  assert(deliveredEvents['company:digital_print'].length === 0, `Burst suppressed within debounce window`);

  // Wait 250ms for debounce timer to expire
  await new Promise(resolve => setTimeout(resolve, 250));

  assert(deliveredEvents['company:digital_print'].length >= 1, `Debounced 5 rapid updates into batched final event`);
  const finalBurstPayload = deliveredEvents['company:digital_print'][0]?.payload;
  assert(finalBurstPayload?.version === 5, `Final debounced event has latest version 5`);

  // TEST 5: Optimistic Concurrency Control (OCC)
  console.log('\n--- TEST 5: Optimistic Concurrency Control ---');
  const existingDoc = {
    _id: '67a80b1234567890abcdef55',
    version: 3,
    updatedAt: new Date(Date.now() - 5000)
  };

  // Case A: Client submits correct current version
  const validCheck = checkOptimisticConcurrency(existingDoc, { version: 3 });
  assert(validCheck.conflict === false, `Write with matching version (3 === 3) accepted`);

  // Case B: Stale write (client submitted old version 2)
  const staleCheck = checkOptimisticConcurrency(existingDoc, { version: 2 });
  assert(staleCheck.conflict === true, `Stale write with old version (2 vs 3) rejected`);
  assert(staleCheck.statusCode === 409, `Stale write returns 409 Conflict status`);
  assert(staleCheck.error.includes('modified by another user'), `Clear conflict message returned`);

  // Case C: Stale write by timestamp (client cached data older than doc)
  const olderTimestamp = new Date(Date.now() - 10000).toISOString();
  const staleTimeCheck = checkOptimisticConcurrency(existingDoc, { lastKnownUpdatedAt: olderTimestamp });
  assert(staleTimeCheck.conflict === true, `Stale write with older timestamp rejected`);

  // TEST 6: Metrics
  console.log('\n--- TEST 6: Observability & Metrics ---');
  const metrics = eventBus.getMetrics();
  assert(metrics.emittedCount >= 4, `Metrics track total emitted count: ${metrics.emittedCount}`);
  assert(metrics.bufferSize > 0, `Circular buffer contains active events: ${metrics.bufferSize}`);
  assert(metrics.roomsCount >= 2, `Active rooms tracked: ${metrics.roomsCount}`);

  console.log('\n====================================================');
  console.log(`TEST SUMMARY: ${passed} PASSED, ${failed} FAILED`);
  console.log('====================================================\n');

  process.exit(failed > 0 ? 1 : 0);
}

runTests().catch(err => {
  console.error('Test execution failed with error:', err);
  process.exit(1);
});
