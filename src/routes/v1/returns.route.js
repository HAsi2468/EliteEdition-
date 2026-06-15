const express = require('express');
const returnsController = require('../../controllers/returns.controller');

const router = express.Router();

router.post('/process', returnsController.processReturn);
router.get('/', returnsController.getReturns);
router.post('/:id/refinish', returnsController.markRefinished);

module.exports = router;
