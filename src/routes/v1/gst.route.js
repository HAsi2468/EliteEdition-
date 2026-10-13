const express = require('express');
const gstController = require('../../controllers/gst.controller');

const router = express.Router();

// Table 12 HSN Summary routes
router.get('/table12', gstController.getTable12Aggregates);
router.get('/table12/export-excel', gstController.exportTable12Excel);

// GTA Freight RCM Ledger routes
router.get('/freight-rcm', gstController.getFreightRcmLedger);
router.post('/freight-rcm', gstController.createFreightBill);
router.put('/freight-rcm/:id', gstController.updateFreightBill);
router.delete('/freight-rcm/:id', gstController.deleteFreightBill);
router.post('/freight-rcm/generate-self-invoices', gstController.generateSelfInvoices);
router.get('/freight-rcm/export-excel', gstController.exportFreightRcmExcel);

module.exports = router;
