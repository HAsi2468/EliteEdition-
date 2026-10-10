const webpush = require('web-push');
const { PushSubscription, User } = require('../db/models');
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
   * Stores or updates a user's browser push subscription across both
   * PushSubscription collection and the User document's pushSubscriptions array.
   */
  async saveSubscription(userId, subscription, userAgent = '', deviceFingerprint = '') {
    if (!subscription || !subscription.endpoint || !subscription.keys) {
      throw new Error('Invalid push subscription payload');
    }

    const { endpoint, keys, expirationTime } = subscription;

    // 1. Update/Upsert in dedicated PushSubscription collection
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
        lastActiveAt: new Date(),
      },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );

    // 2. Sync into User document (User.pushSubscriptions)
    if (userId) {
      try {
        const subDoc = {
          endpoint,
          keys: {
            p256dh: keys.p256dh,
            auth: keys.auth,
          },
          userAgent,
          deviceFingerprint,
          lastActiveAt: new Date(),
        };

        await User.findByIdAndUpdate(userId, {
          $pull: { pushSubscriptions: { endpoint } },
        });

        await User.findByIdAndUpdate(userId, {
          $push: { pushSubscriptions: subDoc },
        });
      } catch (userErr) {
        logger.warn(`[WebPush] User document subscription sync notice: ${userErr.message}`);
      }
    }

    return savedRecord;
  }

  /**
   * Removes an unsubscribed endpoint from both models
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
   * Auto-prunes expired/invalid endpoints returning HTTP 404 or 410 Gone
   */
  async pruneInvalidEndpoint(endpoint, subId = null) {
    if (!endpoint) return;
    logger.info(`[WebPush] Pruning expired/invalid subscription endpoint: ${endpoint.slice(0, 35)}...`);

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
   * Targeted dispatch: Suppresses OS push if user is actively focused in that room
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

    // Clean recipient user IDs
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
      tag: `chat-room-${roomId || 'general'}`, // Collapses multiple messages from same thread
      renotify: true,
      timestamp: Date.now(),
      data: {
        roomId: String(roomId),
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
          TTL: 86400, // 24 hours retention
          urgency: priority === 'urgent' ? 'high' : 'normal',
        });
      } catch (err) {
        if (err.statusCode === 410 || err.statusCode === 404) {
          await this.pruneInvalidEndpoint(sub.endpoint, sub._id);
        } else {
          logger.warn(`[WebPush] Chat push error for ${sub.endpoint.slice(0, 25)}: ${err.message}`);
        }
      }
    });

    await Promise.allSettled(pushPromises);
  }

  /**
   * Dispatches priority job card update push notification to relevant staff/managers
   * @param {Array<string>} recipientUserIds
   * @param {object} jobData
   */
  async dispatchJobUpdateNotification(recipientUserIds, jobData) {
    if (!Array.isArray(recipientUserIds) || recipientUserIds.length === 0) return;

    const cleanUserIds = Array.from(new Set(recipientUserIds.map(String).filter(Boolean)));
    if (cleanUserIds.length === 0) return;

    const {
      jobCardId = '',
      jobNo = '',
      newStage = 'Stage Advanced',
      party = '',
      actorName = 'Operator',
    } = jobData;

    const subscriptions = await PushSubscription.find({
      user: { $in: cleanUserIds },
    });

    if (subscriptions.length === 0) return;

    const notificationPayload = JSON.stringify({
      title: `⚡ Job Card #${jobNo} Stage Update`,
      body: `Advanced to "${newStage}" by ${actorName}${party ? ` • Client: ${party}` : ''}`,
      icon: '/Logo.png',
      badge: '/Logo.png',
      tag: `job-${jobCardId || jobNo}`,
      renotify: true,
      timestamp: Date.now(),
      data: {
        jobCardId,
        url: `/jobcards_fusing_log?job=${jobNo}`,
        priority: 'high',
      },
      actions: [
        { action: 'open', title: 'View Job' },
        { action: 'dismiss', title: 'Dismiss' },
      ],
    });

    const pushPromises = subscriptions.map(async (sub) => {
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
          urgency: 'high',
        });
      } catch (err) {
        if (err.statusCode === 410 || err.statusCode === 404) {
          await this.pruneInvalidEndpoint(sub.endpoint, sub._id);
        }
      }
    });

    await Promise.allSettled(pushPromises);
  }

  /**
   * Dispatches test notification to verify end-to-end delivery
   */
  async dispatchTestNotification(userId) {
    const query = userId ? { user: userId } : {};
    const subscriptions = await PushSubscription.find(query).limit(5);

    if (subscriptions.length === 0) {
      throw new Error('No active push subscriptions found to test');
    }

    const payload = JSON.stringify({
      title: 'Elite Edition ERP • Live Push Test',
      body: 'Production Web Push pipeline verified successfully! Real-time alerts are operational.',
      icon: '/Logo.png',
      badge: '/Logo.png',
      tag: 'test-push-alert',
      timestamp: Date.now(),
      data: { url: '/communication' },
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
  /**
   * Sends push notification payload to a specific user across all registered devices
   */
  async sendPushToUser(userId, payload, options = {}) {
    if (!userId) return [];
    const subscriptions = await PushSubscription.find({ user: userId });
    if (!subscriptions || subscriptions.length === 0) return [];

    const payloadString = typeof payload === 'string' ? payload : JSON.stringify(payload);
    const ttl = options.TTL || 86400;
    const urgency = options.urgency || (payload.priority === 'urgent' ? 'high' : 'normal');

    return Promise.allSettled(
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
          if (err.statusCode === 410 || err.statusCode === 404) {
            await this.pruneInvalidEndpoint(sub.endpoint, sub._id);
          } else {
            logger.warn(`[WebPush] Push error to ${sub.endpoint.slice(0, 30)}: ${err.message}`);
          }
          throw err;
        }
      })
    );
  }

  /**
   * Sends push notification payload to multiple users in parallel
   */
  async sendPushToUsers(userIds, payload, options = {}) {
    if (!Array.isArray(userIds) || userIds.length === 0) return [];
    const uniqueUserIds = Array.from(new Set(userIds.map(String).filter(Boolean)));
    return Promise.allSettled(uniqueUserIds.map((uId) => this.sendPushToUser(uId, payload, options)));
  }
}

module.exports = new WebPushService();
