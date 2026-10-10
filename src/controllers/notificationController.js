const httpStatus = require('http-status').default;
const pushNotificationService = require('../services/pushNotificationService');
const catchAsync = require('../utils/catchAsync');
const ApiError = require('../utils/ApiError');

/**
 * Returns VAPID Public Key for client browser subscription
 */
const getVapidPublicKey = catchAsync(async (req, res) => {
  const publicKey = pushNotificationService.getPublicKey();
  res.send({ publicKey });
});

/**
 * Register/Update Push Subscription for current user
 */
const subscribe = catchAsync(async (req, res) => {
  const userId = req.headers['x-user-id'] || req.user?.id || req.body.userId;
  if (!userId) {
    throw new ApiError(httpStatus.UNAUTHORIZED, 'User authentication required for push registration');
  }

  const { subscription, deviceFingerprint, deviceType } = req.body;
  const userAgent = req.headers['user-agent'] || '';

  const saved = await pushNotificationService.saveSubscription(
    userId,
    subscription,
    userAgent,
    deviceFingerprint,
    deviceType
  );
  res.status(httpStatus.CREATED).send({ success: true, subscriptionId: saved._id });
});

/**
 * Unsubscribe / delete a push registration endpoint
 */
const unsubscribe = catchAsync(async (req, res) => {
  const { endpoint } = req.body;
  if (endpoint) {
    await pushNotificationService.removeSubscription(endpoint);
  }
  res.send({ success: true });
});

/**
 * Smart Focus State Beacon: Updates which room the user is actively viewing
 */
const updateFocus = catchAsync(async (req, res) => {
  const userId = req.headers['x-user-id'] || req.user?.id || req.body.userId;
  if (userId) {
    const { roomId } = req.body;
    await pushNotificationService.updateFocusState(userId, roomId || null);
  }
  res.send({ success: true });
});

/**
 * Live test push notification dispatcher
 */
const sendTestNotification = catchAsync(async (req, res) => {
  const userId = req.headers['x-user-id'] || req.user?.id || req.body?.userId;
  await pushNotificationService.dispatchTestNotification(userId);
  res.send({ success: true, message: 'Test notification sent successfully' });
});

module.exports = {
  getVapidPublicKey,
  subscribe,
  unsubscribe,
  updateFocus,
  sendTestNotification,
};
