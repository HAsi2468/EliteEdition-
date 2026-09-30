const express = require('express');
const httpStatus = require('http-status').default;
const webPushService = require('../../services/webPush.service');
const catchAsync = require('../../utils/catchAsync');
const ApiError = require('../../utils/ApiError');

const router = express.Router();

/**
 * Get VAPID Public Key for client subscription negotiation
 */
router.get(
  '/vapid-key',
  catchAsync(async (req, res) => {
    const publicKey = webPushService.getPublicKey();
    res.send({ publicKey });
  })
);

/**
 * Register/Update Push Subscription for current user
 */
router.post(
  '/subscribe',
  catchAsync(async (req, res) => {
    const userId = req.headers['x-user-id'] || req.user?.id || req.body.userId;
    if (!userId) {
      throw new ApiError(httpStatus.UNAUTHORIZED, 'User authentication required for push registration');
    }

    const { subscription, deviceFingerprint } = req.body;
    const userAgent = req.headers['user-agent'] || '';

    const saved = await webPushService.saveSubscription(userId, subscription, userAgent, deviceFingerprint);
    res.status(httpStatus.CREATED).send({ success: true, subscriptionId: saved._id });
  })
);

/**
 * Unsubscribe / delete a push registration
 */
router.post(
  '/unsubscribe',
  catchAsync(async (req, res) => {
    const { endpoint } = req.body;
    if (endpoint) {
      await webPushService.removeSubscription(endpoint);
    }
    res.send({ success: true });
  })
);

/**
 * Smart Focus State Beacon: Updates which room the user is actively viewing
 */
router.post(
  '/focus',
  catchAsync(async (req, res) => {
    const userId = req.headers['x-user-id'] || req.user?.id || req.body.userId;
    if (userId) {
      const { roomId } = req.body;
      await webPushService.updateFocusState(userId, roomId || null);
    }
    res.send({ success: true });
  })
);

module.exports = router;
