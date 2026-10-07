const express = require('express');
const infraBillController = require('../../controllers/infrastructureBill.controller');

const router = express.Router();

// AWS Cost Explorer Live and Sync endpoints
router.get('/aws-live', infraBillController.getAwsLiveCost);
router.post('/aws-sync', infraBillController.syncAwsCosts);

router
  .route('/')
  .post(infraBillController.createBill)
  .get(infraBillController.getBills);

router
  .route('/:id')
  .put(infraBillController.updateBill)
  .delete(infraBillController.deleteBill);

module.exports = router;
