const webpush = require('web-push');
const { PushSubscription } = require('../db/models');
const logger = require('../config/logger');

// VAPID Credentials for Elite Edition ERP Push Service
const VAPID_PUBLIC_KEY = process.env.VAPID_PUBLIC_KEY || 'BM4d22guTlUHVhOgcRjaBjQv24k_dRivLGlAz79cN3AlWAge3nwE9lB0PFer6qjFzNZely7Rsm9a5pxxWkMfiiQ';
const VAPID_PRIVATE_KEY = process.env.VAPID_PRIVATE_KEY || 'DuKdQ4gWKeIo6N4JGrNGJXLokn1uQIFuaNltDlFjB60';
const VAPID_SUBJECT = process.env.VAPID_SUBJECT || 'mailto:support@eliteedition.in';

webpush.setVapidDetails(VAPID_SUBJECT, VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY);

class WebPushService {
  /**
   * Returns the VAPID Public Key for client browser subscription
   */
  getPublicKey() {
    return VAPID_PUBLIC_KEY;
  }

  /**
   * Stores or updates a user's browser push subscription
   */
  async saveSubscription(userId, subscription, userAgent = '', deviceFingerprint = '') {
    if (!subscription || !subscription.endpoint || !subscription.keys) {
      throw new Error('Invalid push subscription payload');
    }

    const { endpoint, keys, expirationTime } = subscription;

    return PushSubscription.findOneAndUpdate(
      { endpoint },
      {
        user: userId,
        endpoint,
        keys: {
          p256dh: keys.p256dh,
          auth: keys.auth,
        },
        expirationTime: expirationTime || null,
        userAgent,
        deviceFingerprint,
        lastActiveAt: new Date(),
      },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );
  }

  /**
   * Removes an unsubscribed endpoint
   */
  async removeSubscription(endpoint) {
    return PushSubscription.deleteOne({ endpoint });
  }

  /**
   * Updates user focus state for smart duplicate suppression
   */
  async updateFocusState(userId, activeRoomId = null) {
    return PushSubscription.updateMany(
      { user: userId },
      { activeRoomId, lastActiveAt: new Date() }
    );
  }

  /**
   * Dispatches chat push notification to recipient user IDs
   * @param {Array<string>} recipientUserIds 
   * @param {object} messageData 
   */
  async dispatchChatNotification(recipientUserIds, messageData) {
    if (!Array.isArray(recipientUserIds) || recipientUserIds.length === 0) return;

    const {
      senderName = 'Team Member',
      messagePreview = 'Sent a new message',
      roomId = '',
      roomName = '',
      priority = 'normal',
      avatarUrl = '/Logo.png',
    } = messageData;

    // Fetch all active push subscriptions for these recipients
    const subscriptions = await PushSubscription.find({
      user: { $in: recipientUserIds },
    });

    if (subscriptions.length === 0) return;

    const notificationPayload = JSON.stringify({
      title: roomName ? `${senderName} in ${roomName}` : senderName,
      body: messagePreview,
      icon: avatarUrl || '/Logo.png',
      badge: '/Logo.png',
      tag: `chat-room-${roomId}`, // Collapses multiple messages from same room
      renotify: true,
      timestamp: Date.now(),
      data: {
        roomId,
        url: `/communication?room=${roomId}`,
        priority,
      },
      actions: [
        { action: 'open', title: 'Reply' },
        { action: 'dismiss', title: 'Dismiss' },
      ],
    });

    const pushPromises = subscriptions.map(async (sub) => {
      // Smart Focus Check: If user was active in this exact room within last 15 seconds, suppress OS push
      const isActivelyFocused = sub.activeRoomId === String(roomId) &&
        sub.lastActiveAt && (Date.now() - new Date(sub.lastActiveAt).getTime() < 15000);

      if (isActivelyFocused) {
        return; // Suppress duplicate notification
      }

      const pushConfig = {
        endpoint: sub.endpoint,
        keys: {
          p256dh: sub.keys.p256dh,
          auth: sub.keys.auth,
        },
      };

      try {
        await webpush.sendNotification(pushConfig, notificationPayload, {
          TTL: 86400, // 24 hours retention on push service
          urgency: priority === 'urgent' ? 'high' : 'normal',
        });
      } catch (err) {
        // HTTP 410 Gone or 404 Not Found indicates the browser unsubscribed or expired
        if (err.statusCode === 410 || err.statusCode === 404) {
          logger.info(`Cleaning expired push subscription for endpoint: ${sub.endpoint.slice(0, 30)}...`);
          await PushSubscription.deleteOne({ _id: sub._id });
        } else {
          logger.warn(`Push notification send error: ${err.message}`);
        }
      }
    });

    await Promise.allSettled(pushPromises);
  }
}

module.exports = new WebPushService();
