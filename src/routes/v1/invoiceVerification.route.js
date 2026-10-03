const express = require('express');
const { verifyInvoice } = require('../../controllers/invoiceVerification.controller');

const router = express.Router();

/**
 * Public Verification Endpoint for Tax Invoices
 * Accessible without login via QR code or link
 * Supports /verify/invoice/:id and wildcard /verify/invoice/:id(*)
 */
router.get('/:id(*)', verifyInvoice);
router.get('/:id', verifyInvoice);

module.exports = router;
