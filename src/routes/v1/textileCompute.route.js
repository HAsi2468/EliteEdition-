const express = require('express');
const {
  quickInspect,
  fullAnalysis,
  getHealth,
} = require('../../controllers/textileComputeController');

const router = express.Router();

router.get('/health', getHealth);
router.post('/quick-inspect', quickInspect);
router.post('/full-analysis', fullAnalysis);

module.exports = router;
