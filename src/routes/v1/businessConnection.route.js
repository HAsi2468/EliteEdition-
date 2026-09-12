const express = require('express');
const router = express.Router();
const controller = require('../../controllers/businessConnection.controller');

// Master AI Parsing Engine endpoint
router.post('/parse-ai', controller.parseBusinessConnectionAI);

// Directory endpoints
router.get('/', controller.getConnections);
router.post('/', controller.createConnection);
router.put('/:id', controller.updateConnection);
router.delete('/:id', controller.deleteConnection);
router.post('/:id/notes', controller.addNote);

module.exports = router;
