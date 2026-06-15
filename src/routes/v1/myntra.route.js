const express = require('express');
const myntraController = require('../../controllers/myntra.controller');

const router = express.Router();

router.post('/config', myntraController.saveConfig);
router.get('/config', myntraController.getConfig);
router.get('/orders', myntraController.getOrders);
router.post('/sync-inventory', myntraController.syncInventory);
router.post('/discount', myntraController.applyDiscount);
router.post('/order/:orderId/dispatch', myntraController.dispatchOrder);

module.exports = router;
