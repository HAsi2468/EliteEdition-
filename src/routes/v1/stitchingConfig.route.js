const express = require('express');
const stitchingConfigController = require('../../controllers/stitchingConfig.controller');

const router = express.Router();

router
  .route('/')
  .get(stitchingConfigController.getStitchingConfig)
  .put(stitchingConfigController.updateStitchingConfig)
  .post(stitchingConfigController.updateStitchingConfig);

router
  .route('/update')
  .post(stitchingConfigController.updateStitchingConfig);

module.exports = router;
