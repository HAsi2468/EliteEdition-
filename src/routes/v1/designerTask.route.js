const express = require('express');
const designerTaskController = require('../../controllers/designerTask.controller');

const router = express.Router();

router
  .route('/')
  .post(designerTaskController.createDesignerTask)
  .get(designerTaskController.getDesignerTasks);

router
  .route('/stats')
  .get(designerTaskController.getDesignerStats);

router
  .route('/:id')
  .get(designerTaskController.getDesignerTaskById)
  .put(designerTaskController.updateDesignerTask)
  .delete(designerTaskController.deleteDesignerTask);

router
  .route('/:id/stage')
  .put(designerTaskController.updateTaskStage);

module.exports = router;
