const express = require('express');
const controller = require('../../controllers/myntraStorefront.controller');

const router = express.Router();

// Order routes
router.post('/order/:sellerorderId', controller.createOrder);
router.put('/order/:sellerorderId/:EventType', controller.updateOrder);
router.get('/packet/downloadinvoice/:packetId', controller.downloadInvoice);

// Return routes
router.post('/return/:PacketId([0-9a-zA-Z_-]+)', (req, res, next) => {
  // Disambiguate between numeric packetId and alphanumeric returnId
  controller.createReturnRTO(req, res, next);
});
router.put('/return/:returnId/update', controller.updateReturn);

// Audit events
router.get('/events', controller.getOutboundEvents);

module.exports = router;
