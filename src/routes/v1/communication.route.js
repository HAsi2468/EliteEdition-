const express = require('express');
const communicationController = require('../../controllers/communication.controller');
const communicationAdvancedController = require('../../controllers/communicationAdvanced.controller');
const communicationWhatsAppController = require('../../controllers/communicationWhatsApp.controller');
const { requireAuth, requireAdmin, requireGroupAccess } = require('../../middlewares/auth.middleware');

const router = express.Router();

// 1. Enforce Authentication on all Communication routes
router.use(requireAuth);

// 2. Groups & Channels
router.get('/staff', communicationWhatsAppController.getChatStaffDirectory);
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

// 4B. Advanced Chat Features (Mute, Archive, Disappear, Starred, Threads, Info, Bulk, Schedule, Link Preview)
router.post('/groups/:groupId/mute', communicationAdvancedController.toggleMuteRoom);
router.post('/groups/:groupId/archive', communicationAdvancedController.toggleArchiveRoom);
router.post('/groups/:groupId/disappear', communicationAdvancedController.updateDisappearTimer);
router.post('/groups/:groupId/schedule', communicationAdvancedController.scheduleMessage);
router.get('/groups/:groupId/scheduled', communicationAdvancedController.getScheduledMessages);
router.delete('/messages/scheduled/:messageId', communicationAdvancedController.cancelScheduledMessage);
router.post('/messages/:messageId/star', communicationAdvancedController.toggleStarMessage);
router.get('/messages/starred', communicationAdvancedController.getStarredMessages);
router.get('/messages/:messageId/thread', communicationAdvancedController.getThreadMessages);
router.get('/messages/:messageId/info', communicationAdvancedController.getMessageInfo);
router.post('/messages/bulk', communicationAdvancedController.bulkMessageAction);
router.get('/link-preview', communicationAdvancedController.getLinkPreview);

// 4C. WhatsApp-Parity Features (Pin Room, Mark Unread, Chat Lock, Invites, Broadcasts, View-Once, Transcripts, Preferences, Storage)
router.post('/groups/:groupId/pin-room', communicationWhatsAppController.togglePinRoom);
router.post('/groups/:groupId/mark-unread', communicationWhatsAppController.toggleMarkUnread);
router.post('/groups/:groupId/lock', communicationWhatsAppController.setChatLock);
router.post('/groups/:groupId/unlock', communicationWhatsAppController.verifyChatLock);
router.get('/groups/:groupId/invite', communicationWhatsAppController.getInviteLink);
router.post('/groups/:groupId/invite/reset', communicationWhatsAppController.resetInviteLink);
router.patch('/groups/:groupId/invite/settings', communicationWhatsAppController.toggleJoinApproval);
router.post('/groups/:groupId/join-requests/:targetUserId', communicationWhatsAppController.handleJoinRequest);
router.post('/invite/:token/join', communicationWhatsAppController.joinByInviteToken);
router.post('/broadcasts/:groupId/send', communicationWhatsAppController.sendBroadcastMessage);
router.post('/messages/:messageId/view-once', communicationWhatsAppController.markViewOnceOpened);
router.patch('/messages/:messageId/transcript', communicationWhatsAppController.saveVoiceTranscript);
router.post('/messages/:messageId/transcribe', communicationWhatsAppController.transcribeVoiceMessage);
router.post('/messages/:messageId/translate', communicationWhatsAppController.translateChatMessage);
router.get('/preferences', communicationWhatsAppController.getUserChatPreferences);
router.patch('/preferences', communicationWhatsAppController.updateUserChatPreferences);
router.get('/storage', communicationWhatsAppController.getStorageUsage);
router.post('/messages/:messageId/rsvp', communicationWhatsAppController.rsvpGroupEvent);
router.post('/groups/:groupId/call-link', communicationWhatsAppController.createCallLink);
router.post('/groups/:groupId/e2ee', communicationWhatsAppController.toggleRoomE2EE);
router.post('/communities', communicationWhatsAppController.createCommunity);
router.post('/communities/:communityId/groups', communicationWhatsAppController.linkCommunityGroups);
router.post('/saved-messages', communicationWhatsAppController.getOrCreateSavedMessagesRoom);
router.post('/messages/:messageId/remind', communicationWhatsAppController.createMessageReminder);
router.get('/reminders', communicationWhatsAppController.getMyReminders);
router.delete('/reminders/:reminderId', communicationWhatsAppController.deleteReminder);

// 5. Destructive Administrative Endpoints (Admin Only)
router.post('/force-reload-all', requireAdmin, communicationController.forceReloadAllUsers);
router.post('/clear-all', requireAdmin, communicationController.clearAllData);
router.post('/broadcast-version-update', requireAdmin, communicationController.broadcastVersionUpdate);

module.exports = router;
