const express = require('express');
const auth = require('../../middlewares/auth');
const designerTaskController = require('../../controllers/designerTask.controller');

const router = express.Router();

router
  .route('/')
  .post(auth(), designerTaskController.createDesignerTask)
  .get(auth(), designerTaskController.getDesignerTasks);

router
  .route('/stats')
  .get(auth(), designerTaskController.getDesignerStats);

router
  .route('/:id')
  .get(auth(), designerTaskController.getDesignerTaskById)
  .put(auth(), designerTaskController.updateDesignerTask)
  .delete(auth(), designerTaskController.deleteDesignerTask);

router
  .route('/:id/stage')
  .put(auth(), designerTaskController.updateTaskStage);

module.exports = router;
