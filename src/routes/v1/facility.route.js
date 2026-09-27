const express = require('express');
const facilityController = require('../../controllers/facility.controller');

const router = express.Router();

router
  .route('/')
  .get(facilityController.getFacilities)
  .post(facilityController.createFacility);

router
  .route('/:id')
  .put(facilityController.updateFacility)
  .delete(facilityController.deleteFacility);

module.exports = router;
