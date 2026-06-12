const express = require('express');
const inventoryController = require('../../controllers/inventory.controller');
const inventoryReportController = require('../../controllers/inventoryReport.controller');

const router = express.Router();

router.get('/report/stock-value', inventoryReportController.downloadStockValuePdf);
router.get('/report/stock-inward', inventoryReportController.downloadStockInwardPdf);
router.get('/report/stock-outward', inventoryReportController.downloadStockOutwardPdf);

router.route('/')
  .post(inventoryController.createInventory)
  .get(inventoryController.getInventory);

router.route('/:id')
  .put(inventoryController.updateInventory)
  .delete(inventoryController.deleteInventory);

module.exports = router;
