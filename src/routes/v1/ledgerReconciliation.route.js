const express = require('express');
const { requireAuth } = require('../../middlewares/auth.middleware');
const ledgerController = require('../../controllers/ledgerReconciliation.controller');

const router = express.Router();

router.use(requireAuth);

router.get('/parties', ledgerController.getParties);
router.get('/erp-ledger', ledgerController.getErpLedger);
router.post('/parse-statement', ledgerController.parseStatement);
router.post('/reconcile', ledgerController.runReconciliation);
router.post('/reconcile-direct', ledgerController.reconcileDirectFiles);
router.post('/ai-audit', ledgerController.aiAuditDiscrepancies);
router.post('/draft-settlement-notice', ledgerController.generateSettlementNotice);
router.post('/copilot-chat', ledgerController.copilotChat);
router.post('/save-session', ledgerController.saveSession);
router.get('/sessions-history', ledgerController.getSessionsHistory);

module.exports = router;
