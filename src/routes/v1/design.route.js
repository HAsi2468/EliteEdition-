const express = require('express');
const ctrl = require('../../controllers/design.controller');
const router = express.Router();

router.get('/categories', ctrl.getCategories);
router.route('/').get(ctrl.getAll).post(ctrl.create);
router.route('/:id').get(ctrl.getOne).put(ctrl.update).delete(ctrl.remove);

module.exports = router;
