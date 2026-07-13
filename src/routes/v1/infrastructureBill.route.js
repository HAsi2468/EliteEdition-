const express = require('express');
const infraBillController = require('../../controllers/infrastructureBill.controller');

const router = express.Router();

router
  .route('/')
  .post(infraBillController.createBill)
  .get(infraBillController.getBills);

router
  .route('/:id')
  .put(infraBillController.updateBill)
  .delete(infraBillController.deleteBill);

module.exports = router;
