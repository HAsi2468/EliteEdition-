const express = require('express');
const ctrl = require('../../controllers/complaint.controller');
const router = express.Router();

router.get('/analytics', ctrl.getAnalytics);
router.get('/next-number', ctrl.getNextNumber);

router.route('/')
  .get(ctrl.getAll)
  .post(ctrl.create);

router.route('/:id')
  .get(ctrl.getOne)
  .put(ctrl.update)
  .delete(ctrl.remove);

module.exports = router;
