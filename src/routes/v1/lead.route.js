const express = require('express');
const router = express.Router();
const leadController = require('../../controllers/lead.controller');

router.post('/ingest', leadController.ingestAndQualifyLead);
router.get('/', leadController.getLeads);
router.get('/:id', leadController.getLeadById);
router.put('/:id', leadController.updateLead);
router.delete('/:id', leadController.deleteLead);
router.post('/:id/auto-respond', leadController.sendAutoResponse);

module.exports = router;
