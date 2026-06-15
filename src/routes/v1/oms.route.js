const express = require('express');
const omsController = require('../../controllers/oms.controller');

const router = express.Router();

router.post('/return/search', omsController.searchReturns);
router.get('/return/search', omsController.searchReturns); // Support GET for easy client fetch too

router.post('/saleorder/get', omsController.getSaleOrder);
router.get('/saleorder/get', omsController.getSaleOrder); // Support GET/queries too

module.exports = router;
