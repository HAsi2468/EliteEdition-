const webpush = require('web-push');
const { PushSubscription, User } = require('../db/models');
const logger = require('../config/logger');

// VAPID Credentials for Elite Edition ERP Push Service
const VAPID_PUBLIC_KEY = process.env.VAPID_PUBLIC_KEY || 'BM4d22guTlUHVhOgcRjaBjQv24k_dRivLGlAz79cN3AlWAge3nwE9lB0PFer6qjFzNZely7Rsm9a5pxxWkMfiiQ';
const VAPID_PRIVATE_KEY = process.env.VAPID_PRIVATE_KEY || 'DuKdQ4gWKeIo6N4JGrNGJXLokn1uQIFuaNltDlFjB60';
const VAPID_SUBJECT = process.env.VAPID_SUBJECT || 'mailto:support@eliteedition.in';

webpush.setVapidDetails(VAPID_SUBJECT, VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY);

class PushNotificationService {
  /**
   * Return VAPID Public Key for client browser subscription
   */
  getPublicKey() {
    return VAPID_PUBLIC_KEY;
  }

  /**
   * Determine device type from userAgent string if not provided
   */
  detectDeviceType(userAgent = '', explicitType = '') {
    if (explicitType && ['desktop', 'android', 'ios'].includes(explicitType.toLowerCase())) {
      return explicitType.toLowerCase();
    }
    const ua = (userAgent || '').toLowerCase();
    if (/iphone|ipad|ipod/.test(ua)) return 'ios';
    if (/android/.test(ua)) return 'android';
    return 'desktop';
  }

  /**
   * Stores or updates a user's browser/PWA push subscription
   * Synchronizes across both PushSubscription collection and User document
   */
  async saveSubscription(userId, subscription, userAgent = '', deviceFingerprint = '', explicitDeviceType = '') {
    if (!subscription || !subscription.endpoint || !subscription.keys) {
      throw new Error('Invalid push subscription payload');
    }

    const { endpoint, keys, expirationTime } = subscription;
    const deviceType = this.detectDeviceType(userAgent, explicitDeviceType);

    // 1. Upsert in dedicated PushSubscription collection
    const savedRecord = await PushSubscription.findOneAndUpdate(
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
        deviceType,
        lastActiveAt: new Date(),
      },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );

    // 2. Sync into User document's pushSubscriptions array
    if (userId) {
      try {
        const subDoc = {
          endpoint,
          keys: {
            p256dh: keys.p256dh,
            auth: keys.auth,
          },
          deviceType,
          userAgent,
          deviceFingerprint,
          createdAt: new Date(),
          lastActiveAt: new Date(),
        };

        await User.findByIdAndUpdate(userId, {
          $pull: { pushSubscriptions: { endpoint } },
        });

        await User.findByIdAndUpdate(userId, {
          $push: { pushSubscriptions: subDoc },
        });
      } catch (userErr) {
        logger.warn(`[PushService] User document subscription sync notice: ${userErr.message}`);
      }
    }

    return savedRecord;
  }

  /**
   * Removes an unsubscribed endpoint from database
   */
  async removeSubscription(endpoint) {
    if (!endpoint) return;

    await Promise.allSettled([
      PushSubscription.deleteOne({ endpoint }),
      User.updateMany(
        { 'pushSubscriptions.endpoint': endpoint },
        { $pull: { pushSubscriptions: { endpoint } } }
      ),
    ]);
  }

  /**
   * Auto-prunes expired/revoked endpoints returning HTTP 404 or 410 Gone
   */
  async pruneInvalidEndpoint(endpoint, subId = null) {
    if (!endpoint) return;
    logger.info(`[PushService] Pruning expired/invalid subscription endpoint: ${endpoint.slice(0, 40)}...`);

    const cleanupTasks = [
      User.updateMany(
        { 'pushSubscriptions.endpoint': endpoint },
        { $pull: { pushSubscriptions: { endpoint } } }
      ),
    ];

    if (subId) {
      cleanupTasks.push(PushSubscription.deleteOne({ _id: subId }));
    } else {
      cleanupTasks.push(PushSubscription.deleteOne({ endpoint }));
    }

    await Promise.allSettled(cleanupTasks);
  }

  /**
   * Updates user active room focus state for smart duplicate suppression
   */
  async updateFocusState(userId, activeRoomId = null) {
    return PushSubscription.updateMany(
      { user: userId },
      { activeRoomId, lastActiveAt: new Date() }
    );
  }

  /**
   * Core Push Dispatcher: Sends push notification payload to a specific user across all registered devices
   * @param {string} userId - Target User ID
   * @param {object|string} payload - Notification data
   * @param {object} options - Options (TTL, urgency, topic)
   */
  async sendPushToUser(userId, payload, options = {}) {
    if (!userId) return [];

    // Query all active device subscriptions for this user
    const subscriptions = await PushSubscription.find({ user: userId });
    if (!subscriptions || subscriptions.length === 0) {
      return [];
    }

    const payloadString = typeof payload === 'string' ? payload : JSON.stringify(payload);
    const ttl = options.TTL || 86400; // 24 hours
    const urgency = options.urgency || (payload.priority === 'urgent' ? 'high' : 'normal');

    const results = await Promise.allSettled(
      subscriptions.map(async (sub) => {
        const pushConfig = {
          endpoint: sub.endpoint,
          keys: {
            p256dh: sub.keys.p256dh,
            auth: sub.keys.auth,
          },
        };

        try {
          return await webpush.sendNotification(pushConfig, payloadString, {
            TTL: ttl,
            urgency,
          });
        } catch (err) {
          // If browser revoked or expired permission (404 Not Found or 410 Gone), automatically prune
          if (err.statusCode === 410 || err.statusCode === 404) {
            await this.pruneInvalidEndpoint(sub.endpoint, sub._id);
          } else {
            logger.warn(`[PushService] Push error to ${sub.endpoint.slice(0, 30)}: ${err.message}`);
          }
          throw err;
        }
      })
    );

    return results;
  }

  /**
   * Dispatches push notification to multiple recipient user IDs in parallel
   */
  async sendPushToUsers(userIds, payload, options = {}) {
    if (!Array.isArray(userIds) || userIds.length === 0) return [];
    const uniqueUserIds = Array.from(new Set(userIds.map(String).filter(Boolean)));
    const dispatchPromises = uniqueUserIds.map((uId) => this.sendPushToUser(uId, payload, options));
    return Promise.allSettled(dispatchPromises);
  }

  /**
   * High-level chat notification dispatcher with thread collapsing tags & action buttons
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

    const cleanUserIds = Array.from(new Set(recipientUserIds.map(String).filter(Boolean)));
    if (cleanUserIds.length === 0) return;

    // Fetch all active push subscriptions for these recipients
    const subscriptions = await PushSubscription.find({
      user: { $in: cleanUserIds },
    });

    if (subscriptions.length === 0) return;

    const notificationPayload = JSON.stringify({
      title: roomName ? `${senderName} in ${roomName}` : senderName,
      body: messagePreview,
      icon: avatarUrl || '/Logo.png',
      badge: '/Logo.png',
      tag: `chat-room-${roomId || 'general'}`, // Collapses multiple messages per thread gracefully
      renotify: true,
      timestamp: Date.now(),
      priority,
      data: {
        roomId: String(roomId),
        url: `/communication?room=${roomId}`,
        priority,
      },
      actions: [
        { action: 'open', title: 'Open Chat' },
        { action: 'dismiss', title: 'Dismiss' },
      ],
    });

    const pushPromises = subscriptions.map(async (sub) => {
      // Smart In-Tab Focus Check: If user was active in this exact room within last 15s, suppress OS push
      const isActivelyFocused =
        sub.activeRoomId === String(roomId) &&
        sub.lastActiveAt &&
        Date.now() - new Date(sub.lastActiveAt).getTime() < 15000;

      if (isActivelyFocused) {
        return; // Tab is open & focused; suppress OS push
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
          TTL: 86400,
          urgency: priority === 'urgent' ? 'high' : 'normal',
        });
      } catch (err) {
        if (err.statusCode === 410 || err.statusCode === 404) {
          await this.pruneInvalidEndpoint(sub.endpoint, sub._id);
        } else {
          logger.warn(`[PushService] Chat push error for ${sub.endpoint.slice(0, 25)}: ${err.message}`);
        }
      }
    });

    await Promise.allSettled(pushPromises);
  }

  /**
   * Dispatches live test push notification
   */
  async dispatchTestNotification(userId) {
    const query = userId ? { user: userId } : {};
    const subscriptions = await PushSubscription.find(query).limit(5);

    if (subscriptions.length === 0) {
      throw new Error('No active push subscriptions found to test');
    }

    const payload = JSON.stringify({
      title: 'Elite Edition ERP • Live Push Test',
      body: 'Cross-platform Web Push pipeline verified successfully! Real-time alerts are operational on this device.',
      icon: '/Logo.png',
      badge: '/Logo.png',
      tag: 'test-push-alert',
      renotify: true,
      timestamp: Date.now(),
      data: { url: '/communication' },
      actions: [
        { action: 'open', title: 'Open ERP' },
        { action: 'dismiss', title: 'Dismiss' },
      ],
    });

    const results = await Promise.allSettled(
      subscriptions.map(async (sub) => {
        try {
          return await webpush.sendNotification(
            {
              endpoint: sub.endpoint,
              keys: sub.keys,
            },
            payload,
            { TTL: 300, urgency: 'high' }
          );
        } catch (err) {
          if (err.statusCode === 410 || err.statusCode === 404) {
            await this.pruneInvalidEndpoint(sub.endpoint, sub._id);
          }
          throw err;
        }
      })
    );

    return results;
  }
}

const pushNotificationService = new PushNotificationService();
module.exports = pushNotificationService;
