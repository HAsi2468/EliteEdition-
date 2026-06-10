const express = require('express');
const vendorController = require('../../controllers/vendor.controller');

const router = express.Router();

router.route('/')
  .post(vendorController.createVendor)
  .get(vendorController.getVendors);

router.route('/:id')
  .put(vendorController.updateVendor)
  .delete(vendorController.deleteVendor);

module.exports = router;
