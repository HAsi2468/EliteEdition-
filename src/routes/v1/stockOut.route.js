const express = require('express');
const stockOutController = require('../../controllers/stockOut.controller');
const { validateRequest } = require('../../middlewares/validateRequest');
const { stockOutPayloadSchema } = require('../../validations/zod/stockOut.schemas');

const router = express.Router();

router
  .route('/')
  .post(validateRequest({ body: stockOutPayloadSchema }), stockOutController.createStockOut)
  .get(stockOutController.getStockOuts);

module.exports = router;
