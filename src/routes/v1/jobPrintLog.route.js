const express = require('express');
const router = express.Router();
const ctrl = require('../../controllers/jobPrintLog.controller');

router.route('/')
  .post(ctrl.createPrintLog)
  .get(ctrl.getPrintLogs);

router.get('/job/:jobNoOrId', ctrl.getJobCardPrintLogs);

router.route('/:id')
  .put(ctrl.updatePrintLog)
  .delete(ctrl.deletePrintLog);

module.exports = router;
