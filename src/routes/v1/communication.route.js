const express = require('express');
const communicationController = require('../../controllers/communication.controller');
const { requireAuth, requireAdmin, requireGroupAccess } = require('../../middlewares/auth.middleware');

const router = express.Router();

// 1. Enforce Authentication on all Communication routes
router.use(requireAuth);

// 2. Groups & Channels
router.get('/groups', communicationController.getGroups);
router.post('/groups', communicationController.createGroup);
router.patch('/groups/:groupId', requireGroupAccess, communicationController.updateGroup);
router.delete('/groups/:groupId', requireGroupAccess, communicationController.deleteGroup);
router.post('/groups/:groupId/clear', requireGroupAccess, communicationController.clearGroupMessages);
router.post('/groups/sync', requireAdmin, communicationController.syncGroups);

// 3. Message Access & Membership (Protected by Group Access Guard)
router.get('/groups/:groupId/messages', requireGroupAccess, communicationController.getGroupMessages);
router.post('/groups/:groupId/messages', requireGroupAccess, communicationController.postGroupMessage);
router.post('/groups/:groupId/read', requireGroupAccess, communicationController.markGroupAsRead);
router.post('/:groupId/read', requireGroupAccess, communicationController.markGroupAsRead);
router.get('/groups/:groupId/members', requireGroupAccess, communicationController.getGroupMembers);
router.post('/groups/:groupId/members', requireGroupAccess, communicationController.updateGroupMembers);

// 4. Message Actions & DMs
router.post('/activity', communicationController.postActivityEvent);
router.get('/messages', communicationController.searchMessages);
router.get('/search', communicationController.searchMessages);
router.get('/', communicationController.searchMessages);

// Reactions & Pin (supporting both path param and body param styles)
router.post('/messages/:messageId/reactions', communicationController.toggleReaction);
router.post('/messages/:messageId/react', communicationController.toggleReaction);
router.post('/messages/:messageId/pin', communicationController.togglePinMessage);
router.post('/reactions', communicationController.toggleReaction);
router.post('/react', communicationController.toggleReaction);
router.post('/pin', communicationController.togglePinMessage);
router.post('/:messageId/reactions', communicationController.toggleReaction);
router.post('/:messageId/react', communicationController.toggleReaction);
router.post('/:messageId/pin', communicationController.togglePinMessage);

router.post('/messages/:messageId/acknowledge', communicationController.acknowledgeMessage);
router.post('/messages/:messageId/poll-vote', communicationController.votePollMessage);
router.post('/messages/:messageId/forward', communicationController.forwardMessage);
router.patch('/messages/:messageId', communicationController.editMessage);
router.delete('/messages/:messageId', communicationController.deleteMessage);
router.get('/users', communicationController.getUsersForDM);
router.post('/direct', communicationController.createOrGetDirectRoom);

// 5. Destructive Administrative Endpoints (Admin Only)
router.post('/force-reload-all', requireAdmin, communicationController.forceReloadAllUsers);
router.post('/clear-all', requireAdmin, communicationController.clearAllData);
router.post('/broadcast-version-update', requireAdmin, communicationController.broadcastVersionUpdate);

module.exports = router;
