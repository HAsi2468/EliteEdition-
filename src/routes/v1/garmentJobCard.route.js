const express = require('express');
const router = express.Router();
const garmentJobCardController = require('../../controllers/garmentJobCard.controller');

router.get('/next-number', garmentJobCardController.getNextJobNumber);
router.get('/analytics', garmentJobCardController.getAnalyticsSummary);

router.route('/')
  .get(garmentJobCardController.getAll)
  .post(garmentJobCardController.create);

router.route('/:id')
  .get(garmentJobCardController.getOne)
  .put(garmentJobCardController.update)
  .delete(garmentJobCardController.remove);

module.exports = router;
