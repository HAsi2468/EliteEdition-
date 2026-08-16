const express = require('express');
const communicationController = require('../../controllers/communication.controller');

const router = express.Router();

router.get('/groups', communicationController.getGroups);
router.post('/groups/sync', communicationController.syncGroups);
router.get('/groups/:groupId/messages', communicationController.getGroupMessages);
router.get('/groups/:groupId/members', communicationController.getGroupMembers);
router.post('/activity', communicationController.postActivityEvent);

module.exports = router;
