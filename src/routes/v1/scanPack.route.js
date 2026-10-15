const express = require('express');
const scanPackController = require('../../controllers/scanPack.controller');

const router = express.Router();

router.get('/lookup', scanPackController.lookupAwb);
router.post('/pack', scanPackController.packOrder);
router.post('/deliver', scanPackController.markDelivered);
router.post('/return', scanPackController.processReturnScan);
router.put('/return-claim/:id', scanPackController.updateReturnClaim);
router.get('/manifest/pending', scanPackController.getManifestPending);
router.post('/manifest/generate', scanPackController.generateManifest);
router.get('/manifest/list', scanPackController.getManifests);
router.get('/manifest/:manifestId', scanPackController.getManifestById);
router.post('/bulk-deliver', scanPackController.bulkDeliver);
router.get('/history', scanPackController.getScanHistory);

module.exports = router;
