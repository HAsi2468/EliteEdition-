const express = require('express');
const router = express.Router();
const fabricController = require('../../controllers/fabric.controller');

// Create new INWARD transaction
router.post('/inward', fabricController.createInward);

// Create new OUTWARD transaction
router.post('/outward', fabricController.createOutward);

// Import stock ledger data from CSV (JSON array)
router.post('/import-stock', fabricController.importStock);

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

// Fabric Inward/Outward/Lotwise Reports
router.get('/report/inward-data', fabricController.getFabricInwardReportData);
router.get('/report/outward-data', fabricController.getFabricOutwardReportData);
router.get('/report/lotwise-data', fabricController.getFabricLotWiseReportData);
router.get('/report/inward-pdf', fabricController.downloadFabricInwardPdf);
router.get('/report/outward-pdf', fabricController.downloadFabricOutwardPdf);
router.get('/report/lotwise-pdf', fabricController.downloadFabricLotWisePdf);

// Get stock grouped by fabricQuality + panna
router.get('/stock-panna', fabricController.getStockByPanna);

// Get fabric requirement from in-progress job cards
router.get('/requirement', fabricController.getFabricRequirement);

// Update a transaction by ID
router.put('/:id', fabricController.updateTransaction);

// Delete a transaction by ID
router.delete('/:id', fabricController.deleteTransaction);

module.exports = router;
