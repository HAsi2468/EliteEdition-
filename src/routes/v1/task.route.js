const express = require('express');
const taskController = require('../../controllers/task.controller');

const router = express.Router();

router.get('/', taskController.getTasks);
router.post('/', taskController.createTask);
router.get('/:id', taskController.getTaskById);
router.put('/:id', taskController.updateTask);
router.delete('/:id', taskController.deleteTask);

router.post('/:id/timer/start', taskController.startTimer);
router.post('/:id/timer/stop', taskController.stopTimer);
router.post('/:id/timelogs', taskController.addManualTimeLog);

router.post('/:id/checklist', taskController.addChecklistItem);
router.put('/:id/checklist/:itemId', taskController.toggleChecklistItem);
router.post('/:id/comments', taskController.addComment);

// Attachments (stored in Cloudflare R2)
router.post('/:id/attachments', taskController.addAttachment);
router.delete('/:id/attachments/:attachmentId', taskController.deleteAttachment);

module.exports = router;

