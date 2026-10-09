const express = require('express');
const printConfigController = require('../../controllers/printConfig.controller');

const router = express.Router();

router.get('/', printConfigController.getPrintConfig);
router.post('/update', printConfigController.updatePrintConfig);
router.get('/system-lock', printConfigController.getSystemLockStatus);
router.post('/system-lock', printConfigController.setSystemLockStatus);

module.exports = router;
