const express = require('express');
const router = express.Router();
const rawMaterialController = require('../../controllers/rawMaterial.controller');

// Get stock overview on root and /stock
router.get('/', rawMaterialController.getStockOverview);

// Create new INWARD transaction
router.post('/inward', rawMaterialController.createInward);

// Create new OUTWARD transaction
router.post('/outward', rawMaterialController.createOutward);

// Import stock ledger data from CSV (JSON array)
router.post('/import-stock', rawMaterialController.importStock);

// Get all transactions
router.get('/transactions', rawMaterialController.getTransactions);

// Get stock overview grouped by material name
router.get('/stock', rawMaterialController.getStockOverview);

// Download raw materials ledger PDF
router.get('/report/pdf', rawMaterialController.downloadLedgerPdf);

// Sister company inward transfers review & verification
router.get('/sister-transfers', rawMaterialController.getSisterTransfers);
router.put('/sister-transfers/:id/verify', rawMaterialController.verifySisterTransfer);

// Delete an entire raw material and its transactions by name
router.delete('/material', rawMaterialController.deleteMaterialByName);

// Update a transaction by ID
router.put('/:id', rawMaterialController.updateTransaction);

// Delete a transaction by ID
router.delete('/:id', rawMaterialController.deleteTransaction);

module.exports = router;
