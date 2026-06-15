const express = require('express');
const printConfigController = require('../../controllers/printConfig.controller');

const router = express.Router();

router.get('/', printConfigController.getPrintConfig);
router.post('/update', printConfigController.updatePrintConfig);

module.exports = router;
