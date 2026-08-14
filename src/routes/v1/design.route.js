const express = require('express');
const ctrl = require('../../controllers/design.controller');
const router = express.Router();

router.get('/categories', ctrl.getCategories);
router.get('/next-number', ctrl.getNextDesignNumber);
router.post('/import-pkd-orders', ctrl.importPKDOrders);
router.route('/').get(ctrl.getAll).post(ctrl.create);
router.route('/:id').get(ctrl.getOne).put(ctrl.update).delete(ctrl.remove);

module.exports = router;
