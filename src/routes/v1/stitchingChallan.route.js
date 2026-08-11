const express = require('express');
const ctrl = require('../../controllers/stitchingChallan.controller');
const router = express.Router();

router.get('/next-no', ctrl.getNextChallanNo);
router.get('/:id/pdf', ctrl.downloadChallanPdf);

router.route('/')
  .get(ctrl.getChallans)
  .post(ctrl.createChallan);

router.route('/:id')
  .get(ctrl.getOneChallan)
  .put(ctrl.updateChallan)
  .delete(ctrl.deleteChallan);

module.exports = router;
