const express = require('express');
const { getDailyOperationsSummary } = require('../../controllers/digitalPrintDashboard.controller');

const router = express.Router();

router.get('/dashboard', getDailyOperationsSummary);

module.exports = router;
