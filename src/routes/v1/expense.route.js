const express = require('express');
const expenseController = require('../../controllers/expense.controller');

const router = express.Router();

router.get('/next-number', expenseController.getNextVoucherNo);
router.get('/analytics', expenseController.getAnalytics);

router.route('/')
  .get(expenseController.getAll)
  .post(expenseController.create);

router.route('/:id')
  .get(expenseController.getOne)
  .put(expenseController.update)
  .delete(expenseController.remove);

module.exports = router;
