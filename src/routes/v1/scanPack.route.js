const express = require('express');
const scanPackController = require('../../controllers/scanPack.controller');

const router = express.Router();

router.get('/lookup', scanPackController.lookupAwb);
router.post('/pack', scanPackController.packOrder);
router.post('/deliver', scanPackController.markDelivered);
router.post('/return', scanPackController.processReturnScan);
router.get('/history', scanPackController.getScanHistory);

module.exports = router;
