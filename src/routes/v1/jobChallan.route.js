const express = require('express');
const jobChallanController = require('../../controllers/jobChallan.controller');

const router = express.Router();

router.get('/next-number', jobChallanController.getNextChallanNumber);
router.get('/design-lookup', jobChallanController.lookupDesign);
router.get('/', jobChallanController.listJobChallans);
router.post('/', jobChallanController.createJobChallan);
router.put('/:id', jobChallanController.updateJobChallan);
router.patch('/:id/status', jobChallanController.updateJobChallanStatus);
router.delete('/:id', jobChallanController.deleteJobChallan);
router.get('/:id/pdf', jobChallanController.downloadJobChallanPdf);

module.exports = router;
