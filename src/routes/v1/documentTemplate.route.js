const express = require('express');
const documentTemplateController = require('../../controllers/documentTemplate.controller');

const router = express.Router();

router.get('/', documentTemplateController.getTemplates);
router.post('/', documentTemplateController.createTemplate);
router.post('/generate-pdf', documentTemplateController.generatePdf);
router.get('/recent-records', documentTemplateController.getRecentRecords);

router.get('/:id', documentTemplateController.getTemplateById);
router.put('/:id', documentTemplateController.updateTemplate);
router.delete('/:id', documentTemplateController.deleteTemplate);

router.post('/:id/set-default', documentTemplateController.setDefaultTemplate);
router.post('/:id/generate-pdf', documentTemplateController.generatePdf);

module.exports = router;
