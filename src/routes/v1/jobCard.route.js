const express = require('express');
const ctrl = require('../../controllers/jobCard.controller');
const { clientTenancyGuard, verifyRecordOwnership } = require('../../middlewares/clientTenancyGuard');
const { productionVarianceMiddleware } = require('../../services/productionVarianceSentinel');
const router = express.Router();

// Apply client tenancy guard across all job card endpoints
router.use(clientTenancyGuard);

router.get('/calc-exp-time', ctrl.calcExpTimeEndpoint);
router.post('/calc-cost', ctrl.calculatePrintCost);
router.post('/status', (req, res) => res.status(200).json({ success: true, message: 'Job card status updated successfully' }));
router.get('/next-number', ctrl.getNextJobCardNumber);
router.get('/bulk-pdf', ctrl.downloadBulkJobCardsPdf);
router.post('/bulk-pdf', ctrl.downloadBulkJobCardsPdf);
router.get('/pdf/:id', verifyRecordOwnership('JobCard', 'party'), ctrl.downloadJobCardPdf);
router.patch('/:id/stage', verifyRecordOwnership('JobCard', 'party'), productionVarianceMiddleware, ctrl.updateProductionStage);
router.patch('/:id/proofing', verifyRecordOwnership('JobCard', 'party'), ctrl.updateProofingStatus);
router.post('/sync-fusing-from-delivery', ctrl.syncFusingFromDelivery);
router.post('/client-bulk-order', ctrl.createClientBulkOrder);
router.route('/')
  .get(ctrl.getAllJobCards)
  .post(productionVarianceMiddleware, ctrl.createJobCard);
router.route('/:id')
  .get(verifyRecordOwnership('JobCard', 'party'), ctrl.getJobCard)
  .put(verifyRecordOwnership('JobCard', 'party'), productionVarianceMiddleware, ctrl.updateJobCard)
  .delete(verifyRecordOwnership('JobCard', 'party'), ctrl.deleteJobCard);

module.exports = router;


