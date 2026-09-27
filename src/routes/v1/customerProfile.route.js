const express = require('express');
const customerProfileController = require('../../controllers/customerProfile.controller');

const router = express.Router();

router.get('/', customerProfileController.getCustomerProfiles);
router.post('/sync-all', customerProfileController.syncAllFromLeads);
router.get('/:id', customerProfileController.getCustomerProfileById);
router.post('/', customerProfileController.createCustomerProfile);
router.put('/:id', customerProfileController.updateCustomerProfile);
router.post('/:id/interactions', customerProfileController.addInteractionLog);
router.delete('/:id', customerProfileController.deleteCustomerProfile);

module.exports = router;
