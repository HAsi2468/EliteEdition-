/**
 * Express Route Definition: Job Card Completion with Idempotency & Concurrency Guards
 */

const express = require('express');
const { idempotencyMiddleware } = require('../../middlewares/idempotency.middleware');
const { completeJobCardWithLot } = require('../../controllers/jobCardCompletion.controller');

const router = express.Router();

/**
 * @route   POST /api/v1/job-cards/:id/complete
 * @desc    Completes a Job Card, decrements fabric lot meters, and inserts a ledger record.
 * @access  Protected
 * @headers Idempotency-Key (required), If-Match-Version (optional fallback to body)
 */
router.post(
  '/:id/complete',
  idempotencyMiddleware({ action: 'COMPLETE_JOB_CARD_WITH_LOT', required: true }),
  completeJobCardWithLot
);

module.exports = router;
