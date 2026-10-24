const { setActivitySocketIo } = require('../utils/activityEvent');
const { ChatMessage, user: User, Task, ChatRoom } = require('../db/models');
const eventBus = require('../services/eventBus.service');
const { verifyToken } = require('../utils/auth');
const { normalizeCompanyId, COMPANIES } = require('../config/company.constants');
const webPushService = require('../services/webPush.service');
const { sanitizeChatMessage, validateAttachment } = require('../utils/sanitizeChat');
const { dispatchChatMessage } = require('../controllers/chatController');

const getMemberIdString = (m) => {
  if (!m) return '';
  if (typeof m === 'object') {
    if (m._id) return String(m._id);
    return m.toString ? m.toString() : String(m);
  }
  return String(m);
};

const activeUsers = new Map(); // socket.id -> userId
const getOnlineUserIds = () => {
  return Array.from(new Set(activeUsers.values()));
};

const setupSockets = (io) => {
  setActivitySocketIo(io);
  eventBus.setSocketIo(io);

  // Authenticate socket connections & enforce strict company isolation
  io.use(async (socket, next) => {
    try {
      let cookieToken = null;
      if (socket.handshake.headers?.cookie) {
        const match = socket.handshake.headers.cookie.match(/(?:^|;\s*)(?:accessToken|token|elite_auth_token)=([^;]+)/);
        if (match) {
          cookieToken = decodeURIComponent(match[1]);
        }
      }
      const raw = socket.handshake.auth?.token ||
                    socket.handshake.query?.token ||
                    (socket.handshake.headers.authorization && socket.handshake.headers.authorization.replace(/^Bearer\s+/i, '')) ||
                    cookieToken;

      if (!raw) {
        return next(new Error('unauthorized'));
      }

      let payload;
      try {
        payload = await verifyToken(raw);
      } catch (err) {
        return next(new Error('unauthorized'));
      }

      const uid = payload.userId || payload.id || payload.sub || payload._id;
      if (!uid) {
        return next(new Error('unauthorized'));
      }

      let user = await User.findById(uid)
        .select('_id companyId company_id role isActive status allowedCompanies isMainAdmin email name')
        .lean();

      if (!user) {
        try {
          const clientModel = require('../db/models/client.model');
          const client = await clientModel.findById(uid).lean();
          if (client) {
            user = {
              ...client,
              _id: client._id,
              role: 'Client',
              isActive: client.status !== 'Inactive',
              companyId: client.companyId || client.companyCode || 'digital_print',
              name: client.username || client.companyName
            };
          }
        } catch (cErr) {}
      }

      if (!user || user.isActive === false || user.status === 'Inactive') {
        return next(new Error('unauthorized'));
      }

      const canonicalCompany = normalizeCompanyId(user.company_id || user.companyId) || 'digital_print';

      socket.data = socket.data || {};
      socket.data.user = {
        id: String(user._id),
        companyId: canonicalCompany,
        role: user.role
      };
      socket.user = user;
      socket.userId = String(user._id);

      // Determine authorized companies server-side (never trust client)
      const isSuper = user.isMainAdmin || user.role === 'super_admin';
      if (isSuper) {
        socket.authorizedCompanies = COMPANIES.map((c) => c.id);
      } else {
        const allowed = new Set();
        if (canonicalCompany) allowed.add(canonicalCompany);
        if (Array.isArray(user.allowedCompanies)) {
          user.allowedCompanies.forEach((c) => {
            const cid = normalizeCompanyId(c);
            if (cid) allowed.add(cid);
          });
        }
        if (allowed.size === 0) allowed.add('digital_print');
        socket.authorizedCompanies = Array.from(allowed);
      }

      next();
    } catch (err) {
      console.warn('[Socket Auth] Connection rejected:', err.message);
      next(new Error('unauthorized'));
    }
  });

  io.on('connection', (socket) => {
    const { id, companyId } = socket.data?.user || { id: socket.userId, companyId: 'digital_print' };
    console.log(`User connected to socket: ${socket.id} (user: ${id})`);

    // 1. Join user to scoped company rooms and user personal room
    socket.join(`company:${companyId}`);
    socket.join(`user:${id}`);
    socket.join(`user_${id}`);

    if (socket.authorizedCompanies && socket.authorizedCompanies.length > 0) {
      socket.authorizedCompanies.forEach((cid) => {
        socket.join(`company:${cid}`);
      });
    }

    // 2. Track active user and emit scoped presence update
    activeUsers.set(socket.id, id);
    if (socket.authorizedCompanies && socket.authorizedCompanies.length > 0) {
      socket.authorizedCompanies.forEach((cid) => {
        socket.to(`company:${cid}`).emit('presence_update', { userId: id, status: 'online' });
      });
    }

    // 2b. Sync current system lock state to newly connected client
    try {
      const { PrintConfig } = require('../db/models');
      if (PrintConfig) {
        PrintConfig.findOne({ isConfig: true }).lean().then((cfg) => {
          if (cfg && cfg.isSystemLocked) {
            socket.emit('system:lock_status', {
              isSystemLocked: Boolean(cfg.isSystemLocked),
              systemLockedAt: cfg.systemLockedAt || null,
              systemLockedBy: cfg.systemLockedBy || '',
              systemLockMessage: cfg.systemLockMessage || '',
            });
          }
        }).catch(() => {});
      }
    } catch (e) {}

    socket.on('system:get_lock_status', async (callback) => {
      try {
        const { PrintConfig } = require('../db/models');
        const cfg = await PrintConfig.findOne({ isConfig: true }).lean();
        const payload = {
          isSystemLocked: Boolean(cfg?.isSystemLocked),
          systemLockedAt: cfg?.systemLockedAt || null,
          systemLockedBy: cfg?.systemLockedBy || '',
          systemLockMessage: cfg?.systemLockMessage || '',
        };
        if (typeof callback === 'function') callback(payload);
        else socket.emit('system:lock_status', payload);
      } catch (e) {
        if (typeof callback === 'function') callback({ isSystemLocked: false });
      }
    });

    // 3. Switch company room request with server-side permission validation
    socket.on('switch-company', (companyId) => {
      const canonical = normalizeCompanyId(companyId);
      if (!canonical) return;

      const isAllowed = !socket.user ||
                        (socket.authorizedCompanies && socket.authorizedCompanies.includes(canonical)) ||
                        socket.user.isMainAdmin ||
                        socket.user.role === 'super_admin';

      if (isAllowed) {
        socket.join(`company:${canonical}`);
        socket.activeCompanyId = canonical;
      } else {
        console.warn(`[Socket Security] Denied company switch: ${socket.id} -> ${canonical}`);
      }
    });

    // 4. Client reconnection resync handler (requests missed events & messages)
    socket.on('sync-events', async ({ afterMessageId, sinceEventId, companyId, sinceTimestamp, lastReceivedMessageTimestamp }, callback) => {
      try {
        eventBus.metrics.clientReconnects++;
        const targetCompany = normalizeCompanyId(companyId) || socket.data?.user?.companyId || socket.activeCompanyId;
        const missed = eventBus.getMissedEvents(sinceEventId || 0, targetCompany);

        let missedMessages = [];
        if (socket.userId) {
          const userRooms = await ChatRoom.find({ members: socket.userId }).select('_id').lean();
          const rIds = userRooms.map(r => r._id);
          if (rIds.length > 0) {
            const query = { roomId: { $in: rIds } };

            if (afterMessageId) {
              query._id = { $gt: afterMessageId };
            } else if (lastReceivedMessageTimestamp) {
              let syncTimestamp = new Date(lastReceivedMessageTimestamp);
              const now = new Date(Date.now() + 1000);
              if (syncTimestamp > now) {
                syncTimestamp = new Date(Date.now() - 30000);
              }
              query.createdAt = { $gt: syncTimestamp };
            }

            missedMessages = await ChatMessage.find(query)
              .populate('senderId', 'name username email role')
              .sort({ _id: 1 })
              .limit(500)
              .lean();
          }
        }

        socket.emit('elite-chat-sync-message', { messages: missedMessages });

        if (typeof callback === 'function') {
          callback({
            success: true,
            events: missed,
            messages: missedMessages,
            latestEventId: eventBus.currentEventId
          });
        }
      } catch (err) {
        if (typeof callback === 'function') {
          callback({ success: false, error: err.message });
        }
      }
    });

    // Fast zero-overhead health ping for instant client liveness verification
    socket.on('ping-health', (callback) => {
      if (typeof callback === 'function') {
        callback({ status: 'ok', serverTime: Date.now() });
      }
    });

    // Cloudflare Tunnel 100-Second idle drop prevention heartbeat (bidirectional 25s ping/pong)
    socket.on('ping-heartbeat', (data, callback) => {
      socket.lastHeartbeat = Date.now();
      if (typeof callback === 'function') {
        callback({ pong: true, serverTime: Date.now() });
      }
    });

    // Client Page Visibility / Tab Freezing reporting
    socket.on('client-visibility', (data) => {
      if (data && typeof data === 'object') {
        socket.isBackgrounded = data.isVisible === false;
        if (data.activeRoomId) {
          socket.activeRoomId = String(data.activeRoomId);
        }
      }
    });

    // 5. Join room with security enforcement (prevent joining arbitrary company rooms)
    socket.on('join-room', (roomId) => {
      if (typeof roomId !== 'string') return;
      if (roomId.startsWith('company:')) {
        const targetCid = roomId.replace('company:', '');
        const isAllowed = !socket.user ||
                          (socket.authorizedCompanies && socket.authorizedCompanies.includes(targetCid)) ||
                          socket.user?.isMainAdmin;
        if (!isAllowed) {
          console.warn(`[Socket Security] Unauthorized room join rejected: ${roomId} for ${socket.id}`);
          return;
        }
      }
      socket.join(roomId);
      socket.activeRoomId = String(roomId);
      socket.isBackgrounded = false;
    });

    // Leave room
    socket.on('leave-room', (roomId) => {
      if (typeof roomId === 'string') {
        socket.leave(roomId);
        if (socket.activeRoomId === String(roomId)) {
          socket.activeRoomId = null;
        }
      }
    });

    // Register user to personal channel
    socket.on('register-user', (userId) => {
      socket.join(`user_${userId}`);
      socket.join(`user:${userId}`);
      activeUsers.set(socket.id, userId);
      socket.userId = userId;
      if (socket.authorizedCompanies && socket.authorizedCompanies.length > 0) {
        socket.authorizedCompanies.forEach((cid) => {
          io.to(`company:${cid}`).emit('presence-sync', getOnlineUserIds());
        });
      }
    });

    // Handle sending a standard text message (supports quoted replies, attachments, mentions, priority, voice notes, record cards)
    socket.on('send-message', async (data, callback) => {
      try {
        const { roomId, senderId, content, replyTo, attachment, priority, type, activityMeta, recordMentions: inRecordMentions, mentionedUserIds: inMentionedUserIds, clientMsgId } = data;
        
        // Anti-Spoofing: Bind sender strictly to authenticated socket user when available
        const actualSenderId = socket.userId || (socket.user ? String(socket.user._id) : senderId);
        const strSender = String(actualSenderId || '');
        if (!actualSenderId) {
          socket.emit('error-notice', { message: 'Authentication required to post messages' });
          if (typeof callback === 'function') callback({ success: false, error: 'Authentication required' });
          return;
        }

        // Idempotency check: If clientMsgId already saved (e.g. from HTTP attempt), return existing message
        if (clientMsgId) {
          const existingMsg = await ChatMessage.findOne({ roomId, clientMsgId })
            .populate('senderId', 'name username email')
            .populate('readBy', 'name username email')
            .populate({ path: 'reactions.user', select: 'name username email' })
            .populate({ path: 'replyTo', populate: { path: 'senderId', select: 'name username email' } })
            .populate('mentions', 'name username email');
          if (existingMsg) {
            if (typeof callback === 'function') {
              callback({ success: true, message: existingMsg, duplicate: true });
            }
            return;
          }
        }

        // Socket Flood Rate Limiting (max 10 messages per 3 seconds per socket)
        const now = Date.now();
        socket._msgTimestamps = (socket._msgTimestamps || []).filter((t) => now - t < 3000);
        if (socket._msgTimestamps.length >= 10) {
          socket.emit('error-notice', { message: 'Too many messages sent. Please slow down.' });
          return;
        }
        socket._msgTimestamps.push(now);

        const rawContent = typeof content === 'string' ? content : (content != null ? String(content) : '');
        const trimmedContent = rawContent.trim();
        if (!trimmedContent && !attachment && type !== 'poll') {
          socket.emit('error-notice', { message: 'Message content cannot be empty' });
          return;
        }

        // Attachment security check (block executables and oversized payloads)
        if (attachment) {
          const attachCheck = validateAttachment(attachment);
          if (!attachCheck.valid) {
            socket.emit('error-notice', { message: attachCheck.error });
            return;
          }
        }

        // Membership Check: Ensure sender belongs to room
        const targetRoom = await ChatRoom.findById(roomId);
        if (!targetRoom) {
          console.warn(`send-message failed: Room ${roomId} not found`);
          return;
        }

        const isMember = targetRoom.members && targetRoom.members.some((m) => {
          if (!m) return false;
          const memberIdStr = getMemberIdString(m);
          return memberIdStr === String(actualSenderId);
        });

        const isSuperOrAdmin = socket.user && (
          socket.user.role === 'admin' ||
          socket.user.role === 'super_admin' ||
          socket.user.isMainAdmin === true
        );

        if (!isMember) {
          if (targetRoom.type === 'direct') {
            socket.emit('error-notice', { message: 'Access denied: You are not a participant in this direct message conversation' });
            return;
          }
          if (targetRoom.isPrivate && !isSuperOrAdmin) {
            socket.emit('error-notice', { message: 'Access denied: You are not a member of this private channel' });
            return;
          }
          const mongoose = require('mongoose');
          targetRoom.members = targetRoom.members || [];
          if (mongoose.Types.ObjectId.isValid(actualSenderId)) {
            targetRoom.members.push(new mongoose.Types.ObjectId(actualSenderId));
            await targetRoom.save();
          }
        }

        // Sanitize content against stored XSS (trimmed)
        const sanitizedContent = sanitizeChatMessage(trimmedContent || '').trim();
        
        // Parse user mentions (supports explicit mentionedUserIds, full names e.g. @QA Automation Bot, @usernames, and @all / @everyone)
        let mentions = Array.isArray(inMentionedUserIds) ? [...inMentionedUserIds] : [];
        const isMentionAll = /\b@(all|everyone)\b/i.test(sanitizedContent) || mentions.includes('ALL_MEMBERS');
        if (isMentionAll && targetRoom && Array.isArray(targetRoom.members)) {
          targetRoom.members.forEach((m) => {
            const mIdStr = String(typeof m === 'object' ? (m._id || m.id) : m);
            if (mIdStr && mIdStr !== strSender && !mentions.includes(mIdStr)) {
              mentions.push(mIdStr);
            }
          });
          mentions = mentions.filter((id) => id !== 'ALL_MEMBERS');
        }

        if (sanitizedContent) {
          try {
            const usersInDb = await User.find({}).select('_id name username').lean();
            usersInDb.forEach((u) => {
              const uIdStr = String(u._id);
              if (u.name && sanitizedContent.toLowerCase().includes(`@${u.name.toLowerCase()}`)) {
                if (!mentions.includes(uIdStr)) mentions.push(uIdStr);
              } else if (u.username && sanitizedContent.toLowerCase().includes(`@${u.username.toLowerCase()}`)) {
                if (!mentions.includes(uIdStr)) mentions.push(uIdStr);
              }
            });
          } catch (err) {
            console.warn('[socket send-message mention resolution error]:', err.message);
          }
          mentions = Array.from(new Set(mentions)).filter((id) => id !== 'ALL_MEMBERS' && id !== strSender);
        }

        // Parse record mentions e.g. @JC-1004, @DES-55, @INV-201
        const recordMentions = inRecordMentions || [];
        if (!inRecordMentions && sanitizedContent) {
          const recordRegex = /@(JC|DES|INV)-([a-zA-Z0-9_-]+)/gi;
          const recordMatches = [...sanitizedContent.matchAll(recordRegex)];
          recordMatches.forEach((m) => {
            const prefix = m[1].toUpperCase();
            const refVal = m[0].replace(/^@/, '');
            const rType = prefix === 'JC' ? 'jobcard' : prefix === 'DES' ? 'design' : 'invoice';
            recordMentions.push({ recordType: rType, recordRef: refVal });
          });
        }

        const msgType = type || (attachment && attachment.fileType === 'audio' ? 'audio-voice' : 'text');

        // Monotonic room sequence increment
        const updatedRoom = await ChatRoom.findByIdAndUpdate(
          roomId,
          { $inc: { lastSeq: 1 }, updatedAt: new Date() },
          { new: true }
        );
        const roomSeq = updatedRoom?.lastSeq || 1;

        const cleanReplyTo = (replyTo && mongoose.Types.ObjectId.isValid(replyTo)) ? new mongoose.Types.ObjectId(replyTo) : null;
        const messageContent = (sanitizedContent || '').trim() || (attachment?.fileName ? attachment.fileName : 'Message');

        // Save message to MongoDB strictly setting server-enforced createdAt and monotonic roomSeq
        const newMessage = await ChatMessage.create({
          roomId,
          senderId: actualSenderId,
          clientMsgId: clientMsgId || undefined,
          content: messageContent,
          replyTo: cleanReplyTo,
          type: msgType,
          msgType: 'human',
          priority: priority === 'urgent' ? 'urgent' : 'normal',
          attachment: attachment || undefined,
          activityMeta: activityMeta || undefined,
          recordMentions: recordMentions.length > 0 ? recordMentions : undefined,
          mentions: mentions.length > 0 ? mentions : undefined,
          readBy: [actualSenderId],
          createdAt: new Date(),
          roomSeq
        });

        const populatedMessage = await ChatMessage.findById(newMessage._id)
          .populate('senderId', 'name username email')
          .populate('readBy', 'name username email')
          .populate({
            path: 'reactions.user',
            select: 'name username email'
          })
          .populate({
            path: 'replyTo',
            populate: { path: 'senderId', select: 'name username email' }
          })
          .populate('mentions', 'name username email');

        // Intelligent Dispatch: Real-time WebSocket + Background Web Push only if recipient not active in room
        await dispatchChatMessage({
          io,
          roomId,
          populatedMessage,
          targetRoom,
          senderId: actualSenderId,
          rawContent: content,
          priority: priority === 'urgent' ? 'urgent' : 'normal',
        });

        if (typeof callback === 'function') {
          callback({ success: true, message: populatedMessage });
        }

        // Emit direct notification to each mentioned user
        if (mentions.length > 0) {
          const recipientMentionIds = mentions
            .map(String)
            .filter(uId => uId !== String(senderId));

          recipientMentionIds.forEach(uId => {
            io.to(`user_${uId}`).emit('mention-notification', {
              roomId,
              senderName: populatedMessage.senderId.name || populatedMessage.senderId.username,
              content: content,
              messageId: newMessage._id
            });
            io.to(`user_${uId}`).emit('notification:mention', {
              messageId: newMessage._id,
              roomId,
              roomName: targetRoom?.name || 'Group Chat',
              sender: populatedMessage.senderId,
              content: sanitizedContent,
              timestamp: newMessage.createdAt
            });
          });

          if (recipientMentionIds.length > 0 && webPushService && typeof webPushService.sendPushToUsers === 'function') {
            const senderName = populatedMessage.senderId?.name || populatedMessage.senderId?.username || 'Team Member';
            webPushService.sendPushToUsers(recipientMentionIds, {
              title: `💬 @mentioned by ${senderName} in ${targetRoom?.name || 'Chat'}`,
              body: sanitizedContent ? (sanitizedContent.length > 80 ? sanitizedContent.slice(0, 80) + '...' : sanitizedContent) : 'You were mentioned in a message',
              icon: '/Logo.png',
              badge: '/Logo.png',
              tag: `mention-${newMessage._id}`,
              data: {
                url: '/communication',
                roomId: String(roomId),
                type: 'mention'
              }
            }, { urgency: 'high' }).catch(err => console.warn('[Socket send-message mention push] warning:', err.message));
          }
        }

        // ── @EliteAI Bot Handler ──
        if (content && (content.includes('@EliteAI') || content.includes('@bot'))) {
          setTimeout(async () => {
            try {
              let botReply = "🤖 **EliteAI Assistant:** How can I assist you with production, job cards, or reports today?";
              const query = content.replace(/@EliteAI|@bot/gi, '').trim();

              const jcMatch = query.match(/(?:JC-?|job card\s*)(\d+)/i);
              if (jcMatch) {
                const jcNo = jcMatch[1];
                const JobCardModel = require('../db/models').JobCard;
                const card = await JobCardModel.findOne({ jobNo: new RegExp(jcNo, 'i') });
                if (card) {
                  botReply = `🤖 **EliteAI Status Report for JC-${card.jobNo}:**\n` +
                    `• **Party:** ${card.party || 'N/A'}\n` +
                    `• **Design:** ${card.designName || card.designNo || 'N/A'}\n` +
                    `• **Fabric:** ${card.fabric || 'N/A'}\n` +
                    `• **Stage:** ${card.productionStage || 'Order Received'}\n` +
                    `• **Quantity:** ${card.totalMtr ? card.totalMtr + 'm' : '0m'}`;
                } else {
                  botReply = `🤖 **EliteAI:** Sorry, I could not find any Job Card matching **#${jcNo}**.`;
                }
              } else if (query.toLowerCase().includes('summary') || query.toLowerCase().includes('summarize')) {
                const recentMsgs = await ChatMessage.find({ roomId })
                  .sort({ createdAt: -1 })
                  .limit(10)
                  .populate('senderId', 'name username');
                
                const texts = recentMsgs.map(m => `• **${m.senderId?.name || 'User'}**: ${m.content}`).reverse();
                botReply = `🤖 **EliteAI Room Summary (Last 10 messages):**\n\n${texts.join('\n')}`;
              } else if (query.toLowerCase().includes('help')) {
                botReply = `🤖 **EliteAI Command Guide:**\n` +
                  `• \`@EliteAI JC-1004\` - Get live status of Job Card #1004\n` +
                  `• \`@EliteAI summarize\` - Summarize recent discussions in this channel\n` +
                  `• \`@EliteAI help\` - Show this command list`;
              }

              const botMsg = await ChatMessage.create({
                roomId,
                senderId,
                content: botReply,
                type: 'text',
                msgType: 'human',
                readBy: [senderId]
              });

              const populatedBotMsg = await ChatMessage.findById(botMsg._id)
                .populate('senderId', 'name username email');
              
              io.to(roomId).emit('receive-message', populatedBotMsg);
            } catch (err) {
              console.error('Error handling @EliteAI bot response:', err);
            }
          }, 600);
        }
      } catch (error) {
        console.error('[Socket send-message ERROR]:', error.message, error.stack);
        if (typeof callback === 'function') {
          callback({ success: false, error: error.message });
        }
      }
    });


    // Handle typing indicators
    socket.on('typing', (data) => {
      const { roomId, username, isTyping } = data;
      socket.to(roomId).emit('user-typing', { roomId, username, isTyping });
    });

    // Handle toggling emoji reactions
    socket.on('toggle-reaction', async (data) => {
      try {
        const { messageId, emoji, userId, roomId } = data;
        const msg = await ChatMessage.findById(messageId);
        if (!msg) return;

        if (!msg.reactions) msg.reactions = [];

        const existingIdx = msg.reactions.findIndex(
          r => r.emoji === emoji && String(r.user) === String(userId)
        );

        if (existingIdx > -1) {
          msg.reactions.splice(existingIdx, 1);
        } else {
          msg.reactions.push({ emoji, user: userId });
        }

        await msg.save();

        const updatedMsg = await ChatMessage.findById(messageId)
          .populate('senderId', 'name email')
          .populate({
            path: 'reactions.user',
            select: 'name username email'
          })
          .populate({
            path: 'replyTo',
            populate: { path: 'senderId', select: 'name email' }
          });

        io.to(roomId).emit('message-reaction-updated', { messageId, reactions: updatedMsg.reactions });
      } catch (error) {
        console.error('Error toggling reaction:', error);
      }
    });

    // Handle voting on poll
    socket.on('vote-poll', async (data) => {
      try {
        const { messageId, optionId, userId, roomId } = data;
        const msg = await ChatMessage.findById(messageId);
        if (!msg || msg.type !== 'poll' || !msg.pollMeta || msg.pollMeta.isClosed) return;

        const userIdStr = String(userId);
        const isMultiSelect = !!msg.pollMeta.isMultiSelect;

        msg.pollMeta.options.forEach((opt) => {
          opt.votes = opt.votes || [];
          const userIndex = opt.votes.findIndex((v) => String(v._id || v) === userIdStr);
          if (opt.id === optionId) {
            if (userIndex > -1) {
              opt.votes.splice(userIndex, 1);
            } else {
              opt.votes.push(userId);
            }
          } else if (!isMultiSelect) {
            if (userIndex > -1) {
              opt.votes.splice(userIndex, 1);
            }
          }
        });

        await msg.save();

        const updatedMsg = await ChatMessage.findById(messageId)
          .populate('pollMeta.options.votes', 'name username email');

        io.to(roomId).emit('poll-updated', { messageId, pollMeta: updatedMsg.pollMeta });
      } catch (error) {
        console.error('Error in vote-poll socket:', error);
      }
    });

    // Handle creating a task directly from the chat stream
    socket.on('create-task-from-chat', async (data) => {
      try {
        const { roomId, senderId, content, title, priority, assignees, dueDate, replyTo, tags, subTasks, actorId } = data;

        // 1. Save the Task to MongoDB
        const newTask = await Task.create({
          title,
          description: content,
          priority: priority || 'medium',
          status: 'To Do',
          originRoomId: roomId || undefined,
          assignees: assignees || [],
          dueDate: dueDate || undefined,
          tags: tags || [],
          subTasks: subTasks || [],
          activityLogs: actorId ? [{
            user: actorId,
            action: 'Task created',
            details: 'Initialized task fields'
          }] : []
        });

        if (roomId) {
          // 2. Save a special "task-card" message in the chat timeline
          const newMessage = await ChatMessage.create({
            roomId,
            senderId,
            content: 'Task Created', // Fallback text
            replyTo: replyTo || null,
            type: 'task-card',
            taskId: newTask._id,
          });

          // 3. Populate and broadcast the interactive card
          const populatedMessage = await ChatMessage.findById(newMessage._id)
            .populate('senderId', 'name username email')
            .populate({
              path: 'reactions.user',
              select: 'name username email'
            })
            .populate({
              path: 'taskId',
              populate: [
                { path: 'assignees', select: 'name email' },
                { path: 'comments.sender', select: 'name username email' },
                { path: 'timeLogs.user', select: 'name username email' },
                { path: 'activityLogs.user', select: 'name username email' },
                { path: 'subTasks.assignee', select: 'name email' }
              ]
            })
            .populate({
              path: 'replyTo',
              populate: { path: 'senderId', select: 'name username email' }
            });

          io.to(roomId).emit('receive-message', populatedMessage);
        }
        
        // Emit a separate event for the Kanban board to update live within company room
        const fullyPopulatedTask = await Task.findById(newTask._id)
          .populate('assignees', 'name email')
          .populate('comments.sender', 'name username email')
          .populate('timeLogs.user', 'name username email')
          .populate('activityLogs.user', 'name username email')
          .populate('subTasks.assignee', 'name email');
        const taskCompany = fullyPopulatedTask?.companyId ? normalizeCompanyId(fullyPopulatedTask.companyId) : (socket.activeCompanyId || 'digital_print');
        io.to(`company:${taskCompany}`).emit('task-updated', fullyPopulatedTask);
      } catch (error) {
        console.error('Error creating task from chat:', error);
      }
    });

    // Handle updating a task status interactively from inside the chat card
    socket.on('update-task-status', async (data) => {
      try {
        const { taskId, newStatus, actorId } = data;
        
        const updateObj = { status: newStatus };
        if (actorId) {
          updateObj.$push = {
            activityLogs: {
              user: actorId,
              action: 'Status updated',
              details: `Status changed to ${newStatus}`
            }
          };
        }
        
        const updatedTask = await Task.findByIdAndUpdate(
          taskId,
          updateObj,
          { new: true }
        )
        .populate('assignees', 'name email')
        .populate('comments.sender', 'name username email')
        .populate('timeLogs.user', 'name username email')
        .populate('activityLogs.user', 'name username email')
        .populate('subTasks.assignee', 'name email');

        // Broadcast to relevant company room so their UI flips the status color
        const taskCompany = updatedTask?.companyId ? normalizeCompanyId(updatedTask.companyId) : (socket.activeCompanyId || 'digital_print');
        io.to(`company:${taskCompany}`).emit('task-updated', updatedTask);
      } catch (error) {
        console.error('Error updating task status:', error);
      }
    });

    // Handle updating full task details (including checklist and comments)
    socket.on('update-task-details', async (data) => {
      try {
        const { taskId, title, description, priority, assignees, dueDate, checklist, comments, tags, subTasks, timeLogs, activityLogs } = data;

        const updateFields = { title, description, priority, assignees, dueDate };
        if (checklist !== undefined) updateFields.checklist = checklist;
        if (comments !== undefined) updateFields.comments = comments;
        if (tags !== undefined) updateFields.tags = tags;
        if (subTasks !== undefined) updateFields.subTasks = subTasks;
        if (timeLogs !== undefined) updateFields.timeLogs = timeLogs;
        if (activityLogs !== undefined) updateFields.activityLogs = activityLogs;

        const updatedTask = await Task.findByIdAndUpdate(
          taskId,
          updateFields,
          { new: true }
        )
        .populate('assignees', 'name email')
        .populate('comments.sender', 'name username email')
        .populate('timeLogs.user', 'name username email')
        .populate('activityLogs.user', 'name username email')
        .populate('subTasks.assignee', 'name email');

        // Broadcast updated task details to company room
        const taskCompany = updatedTask?.companyId ? normalizeCompanyId(updatedTask.companyId) : (socket.activeCompanyId || 'digital_print');
        io.to(`company:${taskCompany}`).emit('task-updated', updatedTask);
      } catch (error) {
        console.error('Error updating task details:', error);
      }
    });

    // Handle deleting a task
    socket.on('delete-task', async (data) => {
      try {
        const { taskId } = data;
        await Task.findByIdAndDelete(taskId);

        // Broadcast deletion event to company room
        const taskCompany = socket.activeCompanyId || 'digital_print';
        io.to(`company:${taskCompany}`).emit('task-deleted', taskId);
      } catch (error) {
        console.error('Error deleting task:', error);
      }
    });

    // Handle message editing
    socket.on('edit-message', async (data) => {
      try {
        const { messageId, newContent, roomId } = data;
        await ChatMessage.findByIdAndUpdate(messageId, {
          content: newContent,
          isEdited: true
        });
        io.to(roomId).emit('message-edited', { messageId, newContent });
      } catch (error) {
        console.error('Error editing message:', error);
      }
    });

    // Handle message soft deletion
    socket.on('delete-message', async (data) => {
      try {
        const { messageId, roomId } = data;
        const userId = socket.userId;
        const msg = await ChatMessage.findById(messageId);
        if (!msg) return;

        // Purge R2 asset if attached
        if (msg.attachment && msg.attachment.fileUrl) {
          try {
            const { deleteR2Object } = require('../utils/r2Storage');
            const url = new URL(msg.attachment.fileUrl);
            const key = decodeURIComponent(url.pathname.replace(/^\/+/, ''));
            if (key) await deleteR2Object(key);
          } catch (r2Err) {
            console.warn('[Socket delete-message] R2 asset purge warning:', r2Err.message);
          }
        }

        msg.content = 'This message was deleted';
        msg.isDeleted = true;
        msg.deletedBy = userId;
        msg.deletedAt = new Date();
        msg.attachment = null;
        await msg.save();

        const room = await ChatRoom.findById(roomId || msg.roomId);
        if (room && room.lastMessage && String(room.lastMessage._id || room.lastMessage) === String(messageId)) {
          const prevMsg = await ChatMessage.findOne({ roomId: room._id, isDeleted: { $ne: true } })
            .sort({ roomSeq: -1, createdAt: -1 })
            .populate('senderId', 'name username');
          room.lastMessage = prevMsg || null;
          await room.save();
        }

        io.to(String(roomId || msg.roomId)).emit('message-deleted', { messageId, roomId: roomId || msg.roomId });
      } catch (error) {
        console.error('Error deleting message:', error);
      }
    });

    // Handle toggling pin status
    socket.on('toggle-pin-message', async (data) => {
      try {
        const { messageId, roomId } = data;
        const msg = await ChatMessage.findById(messageId);
        if (!msg) return;
        msg.isPinned = !msg.isPinned;
        await msg.save();
        io.to(roomId).emit('message-pin-updated', { messageId, isPinned: msg.isPinned });
      } catch (error) {
        console.error('Error pinning message:', error);
      }
    });

    // Handle updating room settings (name, members list, archiving)
    socket.on('update-room-settings', async (data) => {
      try {
        const { roomId, name, isArchived, members } = data;
        const room = await ChatRoom.findById(roomId);
        if (!room) return;
        if (name !== undefined) room.name = name;
        if (isArchived !== undefined) room.isArchived = isArchived;
        if (members !== undefined) room.members = members;
        await room.save();
        
        const populatedRoom = await ChatRoom.findById(roomId).populate('members', 'name email');
        
        // Broadcast to everyone in the room
        io.to(roomId).emit('room-settings-updated', populatedRoom);
        
        // Notify members in their personal channels
        if (populatedRoom.members && Array.isArray(populatedRoom.members)) {
          populatedRoom.members.forEach((m) => {
            const mid = String(m._id || m);
            io.to(`user:${mid}`).emit('global-room-updated', populatedRoom);
            io.to(`user_${mid}`).emit('global-room-updated', populatedRoom);
          });
        }
      } catch (error) {
        console.error('Error updating room settings:', error);
      }
    });

    // Handle marking room messages as read
    socket.on('read-room-messages', async (data) => {
      try {
        const roomId = data?.roomId || data?.conversationId;
        const userId = data?.userId || socket.userId;
        if (!roomId || !userId) return;

        await ChatMessage.updateMany(
          { roomId, senderId: { $ne: userId }, readBy: { $ne: userId } },
          { $addToSet: { readBy: userId, deliveredTo: userId } }
        );
        const targetRoom = await ChatRoom.findById(roomId);
        let broadcast = io.to(String(roomId));
        if (targetRoom && targetRoom.members && targetRoom.members.length > 0) {
          targetRoom.members.forEach((m) => {
            const mIdStr = getMemberIdString(m);
            if (mIdStr) broadcast = broadcast.to(`user_${mIdStr}`);
          });
        }
        broadcast.emit('room-messages-read', { roomId, userId });
        broadcast.emit('messages-read', { roomId, conversationId: roomId, userId });
      } catch (error) {
        console.error('Error marking messages as read:', error);
      }
    });

    socket.on('mark-as-read', async (data) => {
      try {
        const roomId = data?.roomId || data?.conversationId;
        const userId = data?.userId || socket.userId;
        if (!roomId || !userId) return;

        await ChatMessage.updateMany(
          { roomId, senderId: { $ne: userId }, readBy: { $ne: userId } },
          { $addToSet: { readBy: userId, deliveredTo: userId } }
        );
        io.to(String(roomId)).emit('room-messages-read', { roomId, userId });
        io.to(String(roomId)).emit('messages-read', { roomId, conversationId: roomId, userId });
      } catch (err) {
        console.error('Error in mark-as-read:', err);
      }
    });

    socket.on('sync-delivered', async (data) => {
      try {
        const roomId = data?.roomId || data?.conversationId;
        const userId = data?.userId || socket.userId;
        if (!roomId || !userId) return;

        await ChatMessage.updateMany(
          { roomId, senderId: { $ne: userId }, deliveredTo: { $ne: userId } },
          { $addToSet: { deliveredTo: userId } }
        );
        const targetRoom = await ChatRoom.findById(roomId);
        let broadcast = io.to(String(roomId));
        if (targetRoom && targetRoom.members && targetRoom.members.length > 0) {
          targetRoom.members.forEach((m) => {
            const mIdStr = getMemberIdString(m);
            if (mIdStr) broadcast = broadcast.to(`user_${mIdStr}`);
          });
        }
        broadcast.emit('messages-delivered', { roomId, conversationId: roomId, userId });
      } catch (err) {
        console.error('Error in sync-delivered:', err);
      }
    });

    // Handle production stage transitions for Job Cards & automated Bot logs
    const handleProductionStageUpdate = async (data, callback) => {
      try {
        const { jobCardId, newStage, actorId, actorName } = data;
        const JobCardModel = require('../db/models').JobCard;
        const ChatMessageModel = require('../db/models').ChatMessage;
        const ChatRoomModel = require('../db/models').ChatRoom;
        const OrderActivityLogModel = require('../db/models').OrderActivityLog;

        const card = await JobCardModel.findById(jobCardId);
        if (!card) {
          if (typeof callback === 'function') callback({ success: false, error: 'Job Card not found' });
          return;
        }

        const prevStage = card.productionStage || 'Order Received';
        card.productionStage = newStage;
        await card.save();

        // Create Activity Log
        await OrderActivityLogModel.create({
          jobCardId,
          jobNo: card.jobNo,
          actor: actorId || undefined,
          actorName: actorName || 'System Bot',
          action: 'Production Stage Update',
          previousStage: prevStage,
          newStage: newStage
        });

        // Ensure order contextual chat room exists
        let roomId = card.orderChatRoomId;
        if (!roomId) {
          const newRoom = await ChatRoomModel.create({
            name: `Order #${card.jobNo} (${card.party || 'Client'})`,
            type: 'group'
          });
          card.orderChatRoomId = newRoom._id;
          await card.save();
          roomId = newRoom._id;
        }

        // Post automated Bot Message into contextual chat thread
        const desInfo = card.designName || card.designNo || 'N/A';
        const fabInfo = card.fabric || 'N/A';
        const qtyInfo = card.totalMtr ? `${card.totalMtr}m` : '0m';
        const botMessageContent = `🤖 **Bot Log:** Job Card **#${card.jobNo}** (${card.party || 'Client'}) stage changed to **'${newStage}'** | Design: **${desInfo}** | Fabric: **${fabInfo}** by **${actorName || 'Operator'}**.`;
        
        const botMsg = await ChatMessageModel.create({
          roomId,
          senderId: actorId || card.orderChatRoomId,
          content: botMessageContent,
          type: 'text',
          readBy: [actorId].filter(Boolean)
        });

        const { publishActivity } = require('../utils/activityEvent');
        publishActivity({
          actorId: actorId,
          actorName: actorName || 'Operator',
          action: 'STAGE_ADVANCE',
          module: 'Job Card',
          recordRef: card.jobNo || 'N/A',
          recordId: card._id,
          permissionScope: 'jobcards',
          department: 'Production',
          description: `⚡ **Job Card #${card.jobNo}** stage advanced to **'${newStage}'** | Party: **"${card.party || 'Client'}"** | Design: **${desInfo}** | Fabric: **${fabInfo}** (${qtyInfo}) by **${actorName || 'Operator'}**.`
        }).catch(e => console.warn('publishActivity stage advance failed:', e.message));

        const populatedBotMsg = await ChatMessageModel.findById(botMsg._id)
          .populate('senderId', 'name username email');

        io.to(String(roomId)).emit('receive-message', populatedBotMsg);
        const jobCompany = card.companyId ? normalizeCompanyId(card.companyId) : (socket.activeCompanyId || 'digital_print');
        io.to(`company:${jobCompany}`).emit('job-stage-updated', { jobCardId, jobNo: card.jobNo, newStage, prevStage });

        // Dispatch Web Push to relevant room members
        try {
          const roomDoc = await ChatRoomModel.findById(roomId);
          const recipientIds = (roomDoc?.members || [])
            .map((m) => getMemberIdString(m))
            .filter((id) => id && id !== String(actorId));

          if (recipientIds.length > 0) {
            webPushService.dispatchJobUpdateNotification(recipientIds, {
              jobCardId: String(jobCardId),
              jobNo: String(card.jobNo),
              newStage,
              party: card.party || '',
              actorName: actorName || 'Operator'
            }).catch((e) => console.warn('[WebPush] Job stage update push notice:', e.message));
          }
        } catch (e) {}

        if (typeof callback === 'function') {
          callback({ success: true, jobCardId, newStage, prevStage });
        }
      } catch (err) {
        console.error('Error updating production stage socket:', err);
        if (typeof callback === 'function') {
          callback({ success: false, error: err.message });
        }
      }
    };

    socket.on('update-production-stage', handleProductionStageUpdate);
    socket.on('job-card-stage-update', handleProductionStageUpdate);

    // Handle Proofing & Artwork Approval pipeline events
    socket.on('update-proof-approval', async (data) => {
      try {
        const { jobCardId, status, clientFeedback, actorName } = data;
        const JobCardModel = require('../db/models').JobCard;
        const ChatMessageModel = require('../db/models').ChatMessage;
        const ChatRoomModel = require('../db/models').ChatRoom;

        const card = await JobCardModel.findById(jobCardId);
        if (!card) return;

        if (!card.proofing) card.proofing = {};
        card.proofing.approvalStatus = status;
        if (clientFeedback) card.proofing.clientFeedback = clientFeedback;
        if (status === 'Approved') card.proofing.approvedAt = new Date();

        await card.save();

        let roomId = card.orderChatRoomId;
        if (!roomId) {
          const newRoom = await ChatRoomModel.create({
            name: `Order #${card.jobNo} (${card.party || 'Client'})`,
            type: 'group'
          });
          card.orderChatRoomId = newRoom._id;
          await card.save();
          roomId = newRoom._id;
        }

        const botMessageContent = `🤖 **Proofing Update:** Artwork for Job Card **#${card.jobNo}** has been **${status.toUpperCase()}** by ${actorName || 'Client'}.${clientFeedback ? ` Note: "${clientFeedback}"` : ''}`;
        const botMsg = await ChatMessageModel.create({
          roomId,
          senderId: roomId,
          content: botMessageContent,
          type: 'text'
        });

        io.to(String(roomId)).emit('receive-message', botMsg);
        const jobCompany = card.companyId ? normalizeCompanyId(card.companyId) : (socket.activeCompanyId || 'digital_print');
        io.to(`company:${jobCompany}`).emit('proof-status-updated', { jobCardId, jobNo: card.jobNo, status, clientFeedback });
      } catch (err) {
        console.error('Error updating proof approval socket:', err);
      }
    });

    // ══════════════════════════════════════════════════
    // Real-Time Audio / Video Calling Signaling
    // ══════════════════════════════════════════════════
    socket.on('call-user', async (data) => {
      try {
        if (!data || !data.roomId) return;
        const roomId = String(data.roomId);
        socket.join(roomId);

        // Check if recipient is specified and whether they are currently connected
        if (data.recipientId && String(data.recipientId) !== String(data.caller)) {
          const recipientChannel = `user_${data.recipientId}`;
          const recipientRoom = io.sockets.adapter.rooms.get(recipientChannel);
          const isRecipientOnline = recipientRoom && recipientRoom.size > 0;
          if (!isRecipientOnline) {
            socket.emit('call-failed', {
              roomId,
              recipientId: data.recipientId,
              reason: 'offline',
              message: `${data.recipientName || 'User'} is currently offline or not connected to the network`
            });
            return;
          }
        }

        const payload = {
          roomId: roomId,
          callType: data.callType || 'voice',
          caller: data.caller,
          callerName: data.callerName || data.name || 'Team Member',
          callerAvatar: data.callerAvatar || null,
          recipientId: data.recipientId || null,
          socketId: socket.id,
          timestamp: Date.now()
        };

        // 1. Broadcast to the socket room
        socket.to(roomId).emit('incoming-call', payload);

        // 2. Look up all room members and emit to their dedicated user channels so they receive the call anywhere in the app
        const targetRoom = await ChatRoom.findById(roomId).populate('members');
        if (targetRoom && targetRoom.members && targetRoom.members.length > 0) {
          targetRoom.members.forEach((m) => {
            const mIdStr = getMemberIdString(m);
            if (mIdStr && String(mIdStr) !== String(data.caller)) {
              io.to(`user_${mIdStr}`).emit('incoming-call', payload);
            }
          });
        }

        // 3. If explicit recipientId provided, also emit directly to that user's channel
        if (data.recipientId && String(data.recipientId) !== String(data.caller)) {
          io.to(`user_${data.recipientId}`).emit('incoming-call', payload);
        }
      } catch (err) {
        console.error('Error in socket call-user:', err);
      }
    });

    socket.on('accept-call', (data) => {
      if (data && data.roomId) {
        socket.join(String(data.roomId));
        const payload = {
          roomId: data.roomId,
          accepter: data.accepter,
          caller: data.caller || null,
          socketId: socket.id
        };
        socket.to(String(data.roomId)).emit('call-accepted', payload);
        if (data.caller) {
          io.to(`user_${data.caller}`).emit('call-accepted', payload);
        }
      }
    });

    socket.on('decline-call', (data) => {
      if (data && data.roomId) {
        const payload = {
          roomId: data.roomId,
          decliner: data.decliner
        };
        socket.to(String(data.roomId)).emit('call-declined', payload);
        if (data.caller) {
          io.to(`user_${data.caller}`).emit('call-declined', payload);
        }
      }
    });

    socket.on('end-call', (data) => {
      if (data && data.roomId) {
        const payload = {
          roomId: data.roomId,
          from: data.from
        };
        socket.to(String(data.roomId)).emit('call-ended', payload);
        if (data.recipientId) {
          io.to(`user_${data.recipientId}`).emit('call-ended', payload);
        }
        if (data.caller) {
          io.to(`user_${data.caller}`).emit('call-ended', payload);
        }
      }
    });

    socket.on('call-timeout', (data) => {
      if (data && data.roomId) {
        const payload = {
          roomId: data.roomId,
          caller: data.caller,
          recipientId: data.recipientId,
          reason: 'timeout',
          message: 'Call timed out (No answer)'
        };
        socket.to(String(data.roomId)).emit('call-ended', payload);
        if (data.recipientId) {
          io.to(`user_${data.recipientId}`).emit('call-ended', payload);
        }
      }
    });

    socket.on('webrtc-offer', (data) => {
      if (data && data.roomId) {
        socket.to(String(data.roomId)).emit('webrtc-offer', data);
        if (data.recipientId) {
          io.to(`user_${data.recipientId}`).emit('webrtc-offer', data);
        }
        if (data.caller) {
          io.to(`user_${data.caller}`).emit('webrtc-offer', data);
        }
      }
    });

    socket.on('webrtc-answer', (data) => {
      if (data && data.roomId) {
        socket.to(String(data.roomId)).emit('webrtc-answer', data);
        if (data.caller) {
          io.to(`user_${data.caller}`).emit('webrtc-answer', data);
        }
        if (data.recipientId) {
          io.to(`user_${data.recipientId}`).emit('webrtc-answer', data);
        }
      }
    });

    socket.on('webrtc-ice-candidate', (data) => {
      if (data && data.roomId) {
        socket.to(String(data.roomId)).emit('webrtc-ice-candidate', data);
        if (data.targetUserId) {
          io.to(`user_${data.targetUserId}`).emit('webrtc-ice-candidate', data);
        }
        if (data.recipientId) {
          io.to(`user_${data.recipientId}`).emit('webrtc-ice-candidate', data);
        }
        if (data.caller) {
          io.to(`user_${data.caller}`).emit('webrtc-ice-candidate', data);
        }
      }
    });

    socket.on('disconnect', () => {
      console.log(`User disconnected from socket: ${socket.id}`);
      const disconnectedUid = socket.userId || activeUsers.get(socket.id);
      activeUsers.delete(socket.id);

      const stillOnline = disconnectedUid && Array.from(activeUsers.values()).includes(disconnectedUid);
      if (disconnectedUid && !stillOnline) {
        if (socket.authorizedCompanies && socket.authorizedCompanies.length > 0) {
          socket.authorizedCompanies.forEach((cid) => {
            socket.to(`company:${cid}`).emit('presence_update', { userId: disconnectedUid, status: 'offline', isOnline: false });
            socket.to(`company:${cid}`).emit('presence-update', { userId: disconnectedUid, isOnline: false, status: 'offline' });
          });
        }
        io.emit('presence-change', { userId: disconnectedUid, isOnline: false });
        io.emit('presence-sync', getOnlineUserIds());
      }
    });
  });
};

module.exports = setupSockets;
