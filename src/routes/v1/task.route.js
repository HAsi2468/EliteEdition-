const express = require('express');
const taskController = require('../../controllers/task.controller');
const { redisIdempotencyMiddleware } = require('../../middlewares/redisIdempotency.middleware');

const router = express.Router();
const taskMutationIdempotency = redisIdempotencyMiddleware({ action: 'TASK_MUTATION', required: false });

router.get('/', taskController.getTasks);
router.post('/', taskMutationIdempotency, taskController.createTask);
router.get('/:id', taskController.getTaskById);
router.put('/:id', taskMutationIdempotency, taskController.updateTask);
router.delete('/:id', taskMutationIdempotency, taskController.deleteTask);

router.post('/:id/timer/start', taskController.startTimer);
router.post('/:id/timer/stop', taskController.stopTimer);
router.post('/:id/timelogs', taskMutationIdempotency, taskController.addManualTimeLog);

router.post('/:id/checklist', taskMutationIdempotency, taskController.addChecklistItem);
router.put('/:id/checklist/:itemId', taskMutationIdempotency, taskController.toggleChecklistItem);
router.delete('/:id/checklist/:itemId', taskMutationIdempotency, taskController.deleteChecklistItem);

router.post('/:id/comments', taskMutationIdempotency, taskController.addComment);
router.put('/:id/comments/:commentId', taskMutationIdempotency, taskController.editComment);
router.delete('/:id/comments/:commentId', taskMutationIdempotency, taskController.deleteComment);

// Attachments (stored in Cloudflare R2)
router.post('/:id/attachments', taskMutationIdempotency, taskController.addAttachment);
router.delete('/:id/attachments/:attachmentId', taskMutationIdempotency, taskController.deleteAttachment);

module.exports = router;

