const express = require('express');
const router = express.Router();
const rawMaterialController = require('../../controllers/rawMaterial.controller');

// Create new INWARD transaction
router.post('/inward', rawMaterialController.createInward);

// Create new OUTWARD transaction
router.post('/outward', rawMaterialController.createOutward);

// Get all transactions
router.get('/transactions', rawMaterialController.getTransactions);

// Get stock overview grouped by material name
router.get('/stock', rawMaterialController.getStockOverview);

// Download raw materials ledger PDF
router.get('/report/pdf', rawMaterialController.downloadLedgerPdf);

// Delete a transaction by ID
router.delete('/:id', rawMaterialController.deleteTransaction);

module.exports = router;
