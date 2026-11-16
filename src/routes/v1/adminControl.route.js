const express = require('express');
const ctrl = require('../../controllers/adminControl.controller');
const { requireAdmin } = require('../../middlewares/roleGuard.middleware');

const router = express.Router();

router.use(requireAdmin);

router.get('/overview', ctrl.getOverview);
router.post('/sample-approve/:taskId', ctrl.approveSampleDesign);
router.post('/sample-reject/:taskId', ctrl.rejectSampleDesign);
router.post('/trigger-sync', ctrl.triggerSync);
router.post('/books-lock', ctrl.saveBooksLock);
router.post('/broadcast', ctrl.sendBroadcast);
router.post('/apply-role-template', ctrl.applyRoleTemplate);
router.get('/company-financials', ctrl.getCompanyFinancials);
router.post('/force-logout/:userId', ctrl.forceLogoutUser);
router.get('/chat-storage', ctrl.getChatStorage);
router.post('/chat-storage/cleanup', ctrl.cleanupChatStorage);
router.get('/party-ageing', ctrl.getPartyAgeing);
router.post('/send-payment-reminder', ctrl.sendPaymentReminder);

module.exports = router;
