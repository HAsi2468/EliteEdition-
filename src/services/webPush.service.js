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

  /**
   * Dispatches task assignment push notification to assigned user IDs
   * @param {Array<string>} recipientUserIds 
   * @param {object} taskData 
   */
  async dispatchTaskNotification(recipientUserIds, taskData) {
    if (!Array.isArray(recipientUserIds) || recipientUserIds.length === 0) return;

    // Filter out falsy IDs and deduplicate
    const cleanUserIds = Array.from(new Set(recipientUserIds.map(String).filter(Boolean)));
    if (cleanUserIds.length === 0) return;

    const {
      taskId = '',
      title = 'New Task Assigned',
      priority = 'medium',
      department = 'General',
      dueDate = null,
      createdByName = 'Admin',
      projectRef = '',
    } = taskData;

    try {
      // Fetch all active push subscriptions for these recipients
      const subscriptions = await PushSubscription.find({
        user: { $in: cleanUserIds },
      });

      if (!subscriptions || subscriptions.length === 0) {
        logger.info(`[WebPush] No active push subscriptions found for assignees: ${cleanUserIds.join(', ')}`);
        return;
      }

      const dueStr = dueDate ? ` • Due: ${new Date(dueDate).toLocaleDateString()}` : '';
      const projStr = projectRef ? ` [${projectRef}]` : '';
      const bodyText = `Assigned by ${createdByName} • Priority: ${priority.toUpperCase()} • Dept: ${department}${projStr}${dueStr}`;

      const notificationPayload = JSON.stringify({
        title: `📋 Task Assigned: ${title}`,
        body: bodyText,
        icon: '/Logo.png',
        badge: '/Logo.png',
        tag: `task-${taskId || Date.now()}`,
        renotify: true,
        timestamp: Date.now(),
        data: {
          taskId,
          url: '/workspace',
          priority,
        },
        actions: [
          { action: 'open', title: 'Open Workspace' },
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
            TTL: 86400, // 24 hours
            urgency: priority === 'urgent' || priority === 'high' ? 'high' : 'normal',
          });
        } catch (err) {
          if (err.statusCode === 410 || err.statusCode === 404) {
            logger.info(`Cleaning expired push subscription for endpoint: ${sub.endpoint.slice(0, 30)}...`);
            await PushSubscription.deleteOne({ _id: sub._id });
          } else {
            logger.warn(`Task push notification send error: ${err.message}`);
          }
        }
      });

      await Promise.allSettled(pushPromises);
      logger.info(`[WebPush] Dispatched task assignment push notification to ${subscriptions.length} devices for task: "${title}"`);
    } catch (pushErr) {
      logger.error(`[WebPush] Failed to dispatch task push notification: ${pushErr.message}`);
    }
  }

  /**
   * Broadcasts executive intelligence alert to all active admin/manager devices
   * @param {object} alertData
   */
  async dispatchExecutiveAlert(alertData) {
    const {
      title = '🏭 8:00 PM Executive Intelligence Briefing',
      body = 'Daily production telemetry ready for review.',
      url = '/analytics',
    } = alertData;

    const subscriptions = await PushSubscription.find({});
    if (!subscriptions || subscriptions.length === 0) return;

    const payload = JSON.stringify({
      title,
      body,
      icon: '/Logo.png',
      badge: '/Logo.png',
      tag: 'eod-executive-briefing',
      timestamp: Date.now(),
      data: { url },
    });

    const pushPromises = subscriptions.map(async (sub) => {
      try {
        await webpush.sendNotification({
          endpoint: sub.endpoint,
          keys: sub.keys,
        }, payload, { TTL: 43200, urgency: 'high' });
      } catch (err) {
        if (err.statusCode === 410 || err.statusCode === 404) {
          await PushSubscription.deleteOne({ _id: sub._id });
        }
      }
    });

    await Promise.allSettled(pushPromises);
  }
}

module.exports = new WebPushService();

