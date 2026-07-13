const express = require('express');
const router = express.Router();
const c = require('../../controllers/fabricChallan.controller');

// Get next auto challan number
router.get('/next-no', c.getNextChallanNo);

// Get lot info by lot number (for auto-fill)
router.get('/lot-info/:lotNo', c.getLotInfo);

// Get all challans (with optional filter query params)
router.get('/', c.getChallans);

// Create a new challan
router.post('/', c.createChallan);

// Update a challan
router.put('/:id', c.updateChallan);

// Delete a challan
router.delete('/:id', c.deleteChallan);

module.exports = router;
