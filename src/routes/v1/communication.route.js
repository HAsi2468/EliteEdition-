const express = require('express');
const communicationController = require('../../controllers/communication.controller');

const router = express.Router();

router.get('/groups', communicationController.getGroups);
router.post('/groups', communicationController.createGroup);
router.delete('/groups/:groupId', communicationController.deleteGroup);
router.post('/groups/sync', communicationController.syncGroups);
router.get('/groups/:groupId/messages', communicationController.getGroupMessages);
router.post('/groups/:groupId/messages', communicationController.postGroupMessage);
router.get('/groups/:groupId/members', communicationController.getGroupMembers);
router.post('/groups/:groupId/members', communicationController.updateGroupMembers);
router.post('/activity', communicationController.postActivityEvent);
router.post('/messages/:messageId/acknowledge', communicationController.acknowledgeMessage);
router.post('/messages/:messageId/poll-vote', communicationController.votePollMessage);
router.post('/messages/:messageId/forward', communicationController.forwardMessage);
router.get('/users', communicationController.getUsersForDM);
router.post('/direct', communicationController.createOrGetDirectRoom);
router.post('/force-reload-all', communicationController.forceReloadAllUsers);
router.post('/clear-all', communicationController.clearAllData);

module.exports = router;




