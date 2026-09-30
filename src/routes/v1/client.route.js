const express = require('express');
const clientController = require('../../controllers/client.controller');
const { requireAdmin, guardClientSelfAccess } = require('../../middlewares/clientTenancyGuard');

const router = express.Router();

router.post('/login', clientController.clientLogin);
router.put('/profile/:id', guardClientSelfAccess, clientController.updateClientProfile);

router.get('/', requireAdmin, clientController.getClients);
router.post('/', requireAdmin, clientController.createClient);
router.get('/:id', guardClientSelfAccess, clientController.getClientById);
router.put('/:id', requireAdmin, clientController.updateClient);
router.delete('/:id', requireAdmin, clientController.deleteClient);

module.exports = router;

