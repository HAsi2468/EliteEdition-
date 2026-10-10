const express = require('express');
const {
  getAwsMetrics,
  getMongoClusterMetrics,
  getCloudflareR2Metrics,
  getBillingHistory,
  settleInfrastructureBill,
  downloadTaxInvoice,
  syncAllProviders,
} = require('../controllers/infrastructureController');

const router = express.Router();

// 1. Live Telemetry & Usage Metrics Endpoints
router.get('/metrics/aws', getAwsMetrics);
router.get('/metrics/mongodb', getMongoClusterMetrics);
router.get('/metrics/cloudflare-r2', getCloudflareR2Metrics);

// 2. Billing & In-App Settlement Endpoints
router.get('/billing/history', getBillingHistory);
router.post('/billing/:id/settle', settleInfrastructureBill);
router.get('/billing/:id/invoice', downloadTaxInvoice);

// 3. Multi-Provider Synchronization (AWS, MongoDB Atlas, Cloudflare R2)
router.post('/sync/all', syncAllProviders);

module.exports = router;
