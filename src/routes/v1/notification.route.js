const express = require('express');
const notificationController = require('../../controllers/notificationController');

const router = express.Router();

/**
 * Get VAPID Public Key for client subscription negotiation
 */
router.get('/vapid-key', notificationController.getVapidPublicKey);

/**
 * Register/Update Push Subscription for current user
 */
router.post('/subscribe', notificationController.subscribe);

/**
 * Unsubscribe / delete a push registration
 */
router.post('/unsubscribe', notificationController.unsubscribe);

/**
 * Smart Focus State Beacon: Updates which room the user is actively viewing
 */
router.post('/focus', notificationController.updateFocus);

/**
 * Live test push notification dispatcher
 */
router.post('/test-push', notificationController.sendTestNotification);

module.exports = router;
