const express = require('express');
const fabricVendorController = require('../../controllers/fabricVendor.controller');

const router = express.Router();

router.route('/')
  .post(fabricVendorController.createFabricVendor)
  .get(fabricVendorController.getFabricVendors);

router.route('/:id')
  .put(fabricVendorController.updateFabricVendor)
  .delete(fabricVendorController.deleteFabricVendor);

module.exports = router;
