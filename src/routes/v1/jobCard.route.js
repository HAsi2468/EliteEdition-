const express = require('express');
const ctrl = require('../../controllers/jobCard.controller');
const router = express.Router();

router.get('/calc-exp-time', ctrl.calcExpTimeEndpoint);
router.get('/next-number', ctrl.getNextJobCardNumber);
router.get('/pdf/:id', ctrl.downloadJobCardPdf);
router.route('/').get(ctrl.getAllJobCards).post(ctrl.createJobCard);
router.route('/:id').get(ctrl.getJobCard).put(ctrl.updateJobCard).delete(ctrl.deleteJobCard);

module.exports = router;
