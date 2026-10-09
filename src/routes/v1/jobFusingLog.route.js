const express = require('express');
const router = express.Router();
const ctrl = require('../../controllers/jobFusingLog.controller');

router.route('/')
  .post(ctrl.createFusingLog)
  .get(ctrl.getFusingLogs);

router.get('/job/:jobNoOrId', ctrl.getJobCardFusingLogs);

router.route('/:id')
  .put(ctrl.updateFusingLog)
  .delete(ctrl.deleteFusingLog);

module.exports = router;
