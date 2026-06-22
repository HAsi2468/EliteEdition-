const express = require('express');
const router = express.Router();
const fabricController = require('../../controllers/fabric.controller');

// Create new INWARD transaction
router.post('/inward', fabricController.createInward);

// Create new OUTWARD transaction
router.post('/outward', fabricController.createOutward);

// Get all transactions
router.get('/transactions', fabricController.getTransactions);

// Get stock overview grouped by fabric quality
router.get('/stock', fabricController.getStockOverview);

// Get lot stock
router.get('/lot-stock', fabricController.getLotStock);

// Get lot-wise full ledger
router.get('/lot-ledger', fabricController.getLotLedger);

// Download fabric ledger PDF
router.get('/report/pdf', fabricController.downloadLedgerPdf);

// Delete a transaction by ID
router.delete('/:id', fabricController.deleteTransaction);

module.exports = router;
