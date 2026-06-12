const express = require('express');
const {
  getSalseList,
  saveCsvData,
  dropTable,
} = require('../../controllers/salesList.controller');
const salesReportController = require('../../controllers/salesReport.controller');

const router = express.Router();
router.route('/getData').get(getSalseList);
router.route('/save').get(saveCsvData);
router.route('/drop').get(dropTable);

router.get('/report/pdf', (req, res) => {
  if (req.query.type === 'brand') {
    return salesReportController.downloadBrandReportPdf(req, res);
  }
  return salesReportController.downloadSalesReportPdf(req, res);
});

module.exports = router;
