const express = require('express');
const analyticsController = require('../../controllers/analytics.controller');

const router = express.Router();

router.route('/variant').get(analyticsController.getVariantAnalytics);
router.route('/demographics').get(analyticsController.getDemographicsAnalytics);
router.route('/heatmap').get(analyticsController.getTimeHeatmapData);
router.route('/dead-stock').get(analyticsController.getDeadStockReport);
router.route('/lost-revenue').get(analyticsController.getLostRevenueEstimate);
router.route('/returns-brand').get(analyticsController.getReturnsBrandReport);
router.route('/sales-returns-ratio').get(analyticsController.getSalesReturnsRatioReport);

router.get('/eod-briefing', async (req, res) => {
  try {
    const { generateEodIntelligenceReport } = require('../../services/eodIntelligence.service');
    const targetDate = req.query.date ? new Date(req.query.date) : new Date();
    const briefing = await generateEodIntelligenceReport(targetDate);
    res.json({ success: true, data: briefing });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

module.exports = router;

