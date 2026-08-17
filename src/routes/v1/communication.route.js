const express = require('express');
const communicationController = require('../../controllers/communication.controller');

const router = express.Router();

router.get('/groups', communicationController.getGroups);
router.post('/groups', communicationController.createGroup);
router.delete('/groups/:groupId', communicationController.deleteGroup);
router.post('/groups/sync', communicationController.syncGroups);
router.get('/groups/:groupId/messages', communicationController.getGroupMessages);
router.get('/groups/:groupId/members', communicationController.getGroupMembers);
router.post('/activity', communicationController.postActivityEvent);
router.post('/messages/:messageId/acknowledge', communicationController.acknowledgeMessage);
router.get('/users', communicationController.getUsersForDM);
router.post('/direct', communicationController.createOrGetDirectRoom);
router.post('/force-reload-all', communicationController.forceReloadAllUsers);

module.exports = router;




