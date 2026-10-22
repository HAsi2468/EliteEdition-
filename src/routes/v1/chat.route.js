/**
 * Chat & Agent Router
 * Exposes /agent and /agent/stream endpoints with JWT authentication.
 */

const express = require('express');
const { requireAuth } = require('../../middlewares/auth.middleware');
const chatController = require('../../controllers/chatController');

const router = express.Router();

router.use(requireAuth);

router.post('/agent', chatController.handleAgentChat);
router.post('/agent/stream', chatController.handleAgentChatStream);

module.exports = router;
