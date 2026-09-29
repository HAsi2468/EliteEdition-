/**
 * Job Card Completion Controller
 * Handles HTTP requests for allocating fabric lots and completing job cards
 * with strict concurrency, error handling, and RFC 7807 problem details.
 */

const { allocateAndCompleteJob } = require('../services/raceConditionEngine/jobCardCompletionEngine');
const { ProblemDetailsError } = require('../services/raceConditionEngine/errors');

/**
 * Completes a Job Card by atomically allocating and decrementing fabric meters from a lot.
 * 
 * Route: POST /api/v1/job-cards/:id/complete
 * Headers:
 *   - Idempotency-Key: <unique-uuid>
 *   - If-Match-Version: <int> (Optional fallback to body.version)
 * Body:
 *   - version: <int>
 *   - lotId: <string>
 *   - requestedMeters: <number>
 */
async function completeJobCardWithLot(req, res) {
  const jobCardId = req.params.id || req.body.jobCardId;
  const rawVersion = req.headers['if-match-version'] ?? req.body.version ?? req.body.clientVersion;
  const lotId = req.body.lotId;
  const requestedMeters = parseFloat(req.body.requestedMeters ?? req.body.meters ?? req.body.allocatedMeters);
  const userId = req.user?.id || req.user?._id || req.body.updatedBy || 'SYSTEM_OPERATOR';

  // Defensive input validation
  const errors = [];
  if (!jobCardId) errors.push({ field: 'id', message: 'Job Card ID is required.' });
  if (rawVersion === undefined || rawVersion === null || isNaN(parseInt(rawVersion, 10))) {
    errors.push({ field: 'version', message: "Client 'version' is required for optimistic concurrency verification." });
  }
  if (!lotId) errors.push({ field: 'lotId', message: 'Target fabric Lot ID is required for allocation.' });
  if (isNaN(requestedMeters) || requestedMeters <= 0) {
    errors.push({ field: 'requestedMeters', message: 'Requested meters must be a positive decimal number.' });
  }

  if (errors.length > 0) {
    return res.status(400).json({
      type: 'https://api.eliteedition.in/errors/VALIDATION_ERROR',
      title: 'Validation Failed',
      status: 400,
      code: 'VALIDATION_ERROR',
      detail: 'One or more required fields were missing or invalid.',
      invalidParams: errors,
      instance: req.originalUrl,
      timestamp: new Date().toISOString()
    });
  }

  const clientVersion = parseInt(rawVersion, 10);

  try {
    const result = await allocateAndCompleteJob({
      jobCardId,
      clientVersion,
      lotId,
      requestedMeters,
      userId
    });

    return res.status(200).json({
      type: 'https://api.eliteedition.in/success/JOB_COMPLETED',
      status: 'success',
      message: `Job Card ${jobCardId} successfully completed with ${requestedMeters}m allocated from Lot ${lotId}.`,
      data: result
    });

  } catch (err) {
    if (err instanceof ProblemDetailsError) {
      return res.status(err.status).json(err.toRFC7807(req.originalUrl));
    }

    console.error(`[Unhandled Error in completeJobCardWithLot for ${jobCardId}]:`, err);

    return res.status(500).json({
      type: 'https://api.eliteedition.in/errors/INTERNAL_ERROR',
      title: 'Internal Server Error',
      status: 500,
      code: 'INTERNAL_ERROR',
      detail: err.message || 'An unexpected error occurred while processing job completion.',
      instance: req.originalUrl,
      timestamp: new Date().toISOString()
    });
  }
}

module.exports = {
  completeJobCardWithLot
};
