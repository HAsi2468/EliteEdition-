const express = require('express');
const { verifyChallan } = require('../../controllers/challanVerification.controller');

const router = express.Router();

/**
 * Public Verification Endpoint for Physical Delivery Challans
 * Accessible without login via QR code scan on physical paper
 */
router.get('/:uuid', verifyChallan);

module.exports = router;
