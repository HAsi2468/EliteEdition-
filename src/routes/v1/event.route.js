const express = require('express');
const eventBus = require('../../services/eventBus.service');
const { normalizeCompanyId } = require('../../config/company.constants');

const router = express.Router();

/**
 * GET /v1/events/sync?sinceEventId=100&companyId=digital_print
 * Fallback endpoint for clients to resync missed real-time events over HTTP
 */
router.get('/sync', (req, res) => {
  const sinceEventId = Number(req.query.sinceEventId) || 0;
  const companyId = req.query.companyId || req.company_id;
  const events = eventBus.getMissedEvents(sinceEventId, normalizeCompanyId(companyId));

  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
  res.json({
    success: true,
    events,
    latestEventId: eventBus.currentEventId,
    timestamp: Date.now()
  });
});

/**
 * GET /v1/events/metrics
 * Observability endpoint for real-time socket events
 */
router.get('/metrics', (req, res) => {
  res.json({
    success: true,
    metrics: eventBus.getMetrics()
  });
});

module.exports = router;
