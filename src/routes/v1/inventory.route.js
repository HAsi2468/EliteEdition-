const express = require('express');
const inventoryController = require('../../controllers/inventory.controller');
const inventoryReportController = require('../../controllers/inventoryReport.controller');

const router = express.Router();

router.get('/report/stock-value', inventoryReportController.downloadStockValuePdf);
router.get('/report/stock-inward', inventoryReportController.downloadStockInwardPdf);
router.get('/report/stock-outward', inventoryReportController.downloadStockOutwardPdf);
router.get('/report/stock-value-data', inventoryReportController.getStockValueData);
router.get('/report/stock-inward-data', inventoryReportController.getStockInwardData);
router.get('/report/stock-outward-data', inventoryReportController.getStockOutwardData);

router.route('/')
  .post(inventoryController.createInventory)
  .get(inventoryController.getInventory);

router.route('/inventorySnapshot/get').get(inventoryController.getInventorySnapshot);
router.route('/inventorySnapshot/sync').post(inventoryController.syncInventorySnapshot);

router.route('/:id')
  .put(inventoryController.updateInventory)
  .delete(inventoryController.deleteInventory);

module.exports = router;
