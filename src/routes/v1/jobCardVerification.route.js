const express = require('express');
const { verifyJobCard } = require('../../controllers/jobCardVerification.controller');

const router = express.Router();

/**
 * Public Verification Endpoint for Physical Job Cards
 * Accessible without login via QR code scan on physical paper
 */
router.get('/:id', verifyJobCard);

module.exports = router;
