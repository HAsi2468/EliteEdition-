const express = require('express');
const costingController = require('../../controllers/costing.controller');

const router = express.Router();

router.get('/monthly-report', costingController.getMonthlyCostingReport);
router.post('/monthly-overheads', costingController.saveMonthlyOverheads);

module.exports = router;
