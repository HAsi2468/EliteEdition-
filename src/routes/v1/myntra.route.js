const express = require('express');
const myntraController = require('../../controllers/myntra.controller');

const router = express.Router();

// Configuration & Token
router.post('/config', myntraController.saveConfig);
router.get('/config', myntraController.getConfig);
router.post('/authorization/refresh_token', myntraController.refreshToken);

// Orders & PPMP Lifecycle
router.get('/orders', myntraController.getOrders);
router.post('/order/:id/accept', myntraController.acceptOrder);
router.post('/orders/accept', myntraController.bulkAcceptOrders);
router.post('/order/readyToDispatch', myntraController.readyToDispatch);
router.post('/order/readyToShip', myntraController.readyToShip);
router.post('/readyToShip', myntraController.readyToShip);

// Documents & Labels
router.get('/packet/:id/shippingLabel', myntraController.getShippingLabel);
router.get('/packet/:id/getDocument', myntraController.getDocument);

// Catalog & Inventory
router.get('/catalog', myntraController.getCatalog);
router.put('/sku', myntraController.addOrUpdateSku);
router.put('/warehouse', myntraController.mapWarehouse);
router.put('/inventory/update', myntraController.updateInventory);
router.post('/sync-inventory', myntraController.syncInventory);
router.put('/discount/override', myntraController.overrideDiscount);
router.post('/discount', myntraController.applyDiscount);

// Dispatch & Tracking (Post-pack)
router.get('/shipments', myntraController.getShipments);
router.post('/mock/packet/:id/shipped', myntraController.mockPacketShipped);
router.post('/mock/packet/:id/delivered', myntraController.mockPacketDelivered);

// Returns & RTO
router.get('/returns', myntraController.getReturns);
router.get('/mock/return/:packetId', myntraController.getReturnDetails);
router.post('/mock/return/:returnId/update', myntraController.updateReturn);

// Mockify Simulator
router.post('/mock/order', myntraController.mockInjectOrder);
router.post('/mock/order/:id/itemCancellation', myntraController.mockCancelOrder);
router.post('/mock/order/:id/onhold', myntraController.mockHoldOrder);
router.post('/mock/order/:id/unhold', myntraController.mockUnholdOrder);

// Webhooks
router.post('/webhook', myntraController.receiveWebhook);
router.get('/webhook/events', myntraController.getWebhookEvents);
router.delete('/webhook/events', myntraController.clearWebhookEvents);

module.exports = router;
