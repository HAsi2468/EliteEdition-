const express = require('express');
const router = express.Router();
const validate = require('../../middlewares/validate');
const jobPrintLogValidation = require('../../validations/jobPrintLog.validation');
const ctrl = require('../../controllers/jobPrintLog.controller');

router.route('/')
  .post(validate(jobPrintLogValidation.createPrintLog), ctrl.createPrintLog)
  .get(ctrl.getPrintLogs);

router.get('/job/:jobNoOrId', ctrl.getJobCardPrintLogs);

router.route('/:id')
  .put(validate(jobPrintLogValidation.updatePrintLog), ctrl.updatePrintLog)
  .delete(ctrl.deletePrintLog);

module.exports = router;
