const express = require('express');
const stockOutController = require('../../controllers/stockOut.controller');

const router = express.Router();

router
  .route('/')
  .post(stockOutController.createStockOut)
  .get(stockOutController.getStockOuts);

module.exports = router;
