/**
 * ============================================================================
 * ELITE ERP ENTERPRISE - CLIENT TELEMETRY & CRASH INGESTION ROUTE
 * Receives frontend error boundary stack traces and hardware diagnostic reports
 * ============================================================================
 */

const express = require('express');
const router = express.Router();
const logger = require('../../config/logger');

router.post('/errors', (req, res) => {
  const {
    incidentId,
    name,
    message,
    stack,
    componentStack,
    url,
    pathname,
    userAgent,
    timestamp,
    userSessionId
  } = req.body || {};

  logger.error(`[Client-Crash-Telemetry] Captured frontend exception: ${name}: ${message}`, {
    incidentId,
    name,
    message,
    url,
    pathname,
    userAgent,
    timestamp,
    userSessionId,
    componentStack,
    stack
  });

  res.status(202).json({
    success: true,
    message: 'Crash report recorded successfully',
    incidentId: incidentId || 'UNKNOWN'
  });
});

module.exports = router;
