const express = require('express');
const deliveryChallanController = require('../../controllers/deliveryChallan.controller');

const router = express.Router();

// Numbering & Overview
router.get('/next-no', deliveryChallanController.getNextChallanNo);

// CRUD
router.get('/', deliveryChallanController.getChallans);
router.post('/', deliveryChallanController.createChallan);
router.get('/:id', deliveryChallanController.getChallanById);
router.get('/:id/audit-trail', deliveryChallanController.getChallanAuditTrail);
router.put('/:id', deliveryChallanController.updateChallan);
router.delete('/:id', deliveryChallanController.deleteChallan);

// 1-Click Convert Delivery Challan to Tax Invoice
router.post('/:id/convert-to-invoice', deliveryChallanController.convertToInvoice);

// Download / Print PDF
router.get('/:id/pdf', deliveryChallanController.downloadChallanPdf);

module.exports = router;
