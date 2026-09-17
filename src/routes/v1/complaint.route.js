const express = require('express');
const ctrl = require('../../controllers/complaint.controller');
const router = express.Router();

router.get('/analytics', ctrl.getAnalytics);
router.get('/next-number', ctrl.getNextNumber);
router.get('/lookup-order', ctrl.lookupOrderDetails);
router.delete('/clear-all', ctrl.clearAll);
router.get('/r2-attachments', ctrl.listR2ComplaintAttachments);
router.delete('/r2-attachments', ctrl.clearR2ComplaintDepartmentAttachments);


router.route('/')
  .get(ctrl.getAll)
  .post(ctrl.create);

router.route('/:id')
  .get(ctrl.getOne)
  .put(ctrl.update)
  .delete(ctrl.remove);

router.post('/:id/comments', ctrl.addComment);

module.exports = router;
