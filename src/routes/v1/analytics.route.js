const express = require('express');
const analyticsController = require('../../controllers/analytics.controller');

const router = express.Router();

router.route('/variant').get(analyticsController.getVariantAnalytics);
router.route('/demographics').get(analyticsController.getDemographicsAnalytics);
router.route('/heatmap').get(analyticsController.getTimeHeatmapData);
router.route('/dead-stock').get(analyticsController.getDeadStockReport);
router.route('/lost-revenue').get(analyticsController.getLostRevenueEstimate);

module.exports = router;
