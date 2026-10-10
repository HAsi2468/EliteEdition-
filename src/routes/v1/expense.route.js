const express = require('express');
const expenseController = require('../../controllers/expense.controller');

const router = express.Router();

router.get('/next-number', expenseController.getNextVoucherNo);
router.get('/analytics', expenseController.getAnalytics);
router.get('/ledger-summary', expenseController.getLedgerSummary);
router.get('/ledger-settings', expenseController.getLedgerSettings);
router.post('/ledger-settings', expenseController.saveLedgerSettings);
router.put('/ledger-settings', expenseController.saveLedgerSettings);
router.delete('/clear-all', expenseController.clearAll);

router.route('/')
  .get(expenseController.getAll)
  .post(expenseController.create);

router.route('/:id')
  .get(expenseController.getOne)
  .put(expenseController.update)
  .delete(expenseController.remove);

module.exports = router;
