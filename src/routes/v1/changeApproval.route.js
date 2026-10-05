const express = require('express');
const router = express.Router();
const changeApprovalController = require('../../controllers/changeApproval.controller');
const { requireAdmin } = require('../../middlewares/auth.middleware');

// All approval management endpoints require Admin privileges
router.get('/', requireAdmin, changeApprovalController.getApprovalRequests);
router.get('/stats', requireAdmin, changeApprovalController.getApprovalStats);
router.get('/settings', requireAdmin, changeApprovalController.getSettings);
router.patch('/settings', requireAdmin, changeApprovalController.updateSettings);

router.post('/:id/approve', requireAdmin, changeApprovalController.approveRequest);
router.post('/:id/reject', requireAdmin, changeApprovalController.rejectRequest);

router.post('/bulk-approve', requireAdmin, changeApprovalController.bulkApprove);
router.post('/bulk-reject', requireAdmin, changeApprovalController.bulkReject);

module.exports = router;
