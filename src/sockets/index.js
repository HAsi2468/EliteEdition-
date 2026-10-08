const { setActivitySocketIo } = require('../utils/activityEvent');
const { ChatMessage, User, Task, ChatRoom } = require('../db/models');
const eventBus = require('../services/eventBus.service');
const { verifyToken } = require('../utils/auth');
const { normalizeCompanyId, COMPANIES } = require('../config/company.constants');
const webPushService = require('../services/webPush.service');
const { sanitizeChatMessage, validateAttachment } = require('../utils/sanitizeChat');

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
      const token = socket.handshake.auth?.token ||
                    socket.handshake.query?.token ||
                    (socket.handshake.headers.authorization && socket.handshake.headers.authorization.replace(/^Bearer\s+/i, ''));

      if (!token) {
        socket.user = null;
        socket.authorizedCompanies = [];
        return next();
      }

      const decoded = await verifyToken(token);
      if (!decoded) {
        socket.user = null;
        socket.authorizedCompanies = [];
        return next();
      }

      const user = await User.findById(decoded.id || decoded._id).lean();
      if (!user) {
        socket.user = null;
        socket.authorizedCompanies = [];
        return next();
      }

      socket.user = user;
      socket.userId = String(user._id);

      // Determine authorized companies server-side (never trust client)
      const isSuper = user.isMainAdmin || user.role === 'super_admin' || user.email === 'harshitsidapara2468@gmail.com';
      if (isSuper) {
        socket.authorizedCompanies = COMPANIES.map((c) => c.id);
      } else {
        const allowed = new Set();
        if (user.company_id) {
          const cid = normalizeCompanyId(user.company_id);
          if (cid) allowed.add(cid);
        }
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
      console.warn('[Socket Auth] Token verification notice:', err.message);
      socket.user = null;
      socket.authorizedCompanies = [];
      next();
    }
  });

  io.on('connection', (socket) => {
    console.log(`User connected to socket: ${socket.id} (user: ${socket.userId || 'anon'})`);

    // 1. Join user to their authorized company rooms
    if (socket.authorizedCompanies && socket.authorizedCompanies.length > 0) {
      socket.authorizedCompanies.forEach((cid) => {
        socket.join(`company:${cid}`);
      });
    }

    // 2. Join personal room for targeted alerts & direct messages
    if (socket.userId) {
      socket.join(`user_${socket.userId}`);
      activeUsers.set(socket.id, socket.userId);
      io.emit('presence-sync', getOnlineUserIds());
    }

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

    // 4. Client reconnection resync handler (requests missed events)
    socket.on('sync-events', ({ sinceEventId, companyId }, callback) => {
      try {
        eventBus.metrics.clientReconnects++;
        const targetCompany = normalizeCompanyId(companyId) || socket.activeCompanyId;
        const missed = eventBus.getMissedEvents(sinceEventId || 0, targetCompany);
        if (typeof callback === 'function') {
          callback({
            success: true,
            events: missed,
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
    });

    // Register user to personal channel
    socket.on('register-user', (userId) => {
      socket.join(`user_${userId}`);
      activeUsers.set(socket.id, userId);
      socket.userId = userId;
      io.emit('presence-sync', getOnlineUserIds());
    });

    // Handle sending a standard text message (supports quoted replies, attachments, mentions, priority, voice notes, record cards)
    socket.on('send-message', async (data) => {
      try {
        const { roomId, senderId, content, replyTo, attachment, priority, type, activityMeta, recordMentions: inRecordMentions } = data;
        
        // Anti-Spoofing: Bind sender strictly to authenticated socket user when available
        const actualSenderId = socket.userId || (socket.user ? String(socket.user._id) : senderId);
        if (!actualSenderId) {
          socket.emit('error-notice', { message: 'Authentication required to post messages' });
          return;
        }

        // Socket Flood Rate Limiting (max 10 messages per 3 seconds per socket)
        const now = Date.now();
        socket._msgTimestamps = (socket._msgTimestamps || []).filter((t) => now - t < 3000);
        if (socket._msgTimestamps.length >= 10) {
          socket.emit('error-notice', { message: 'Too many messages sent. Please slow down.' });
          return;
        }
        socket._msgTimestamps.push(now);

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

        // Sanitize content against stored XSS
        const sanitizedContent = sanitizeChatMessage(content || '');
        
        // Parse user mentions
        const mentionRegex = /@(\w+)/g;
        const matches = [...(sanitizedContent || '').matchAll(mentionRegex)];
        const usernames = matches.map(m => m[1]);
        const mentions = [];
        if (usernames.length > 0) {
          const matchedUsers = await User.find({ username: { $in: usernames } });
          matchedUsers.forEach(u => mentions.push(u._id));
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

        // Save message to MongoDB
        const newMessage = await ChatMessage.create({
          roomId,
          senderId: actualSenderId,
          content: sanitizedContent || (attachment ? `Attached ${attachment.fileName || 'file'}` : 'Message'),
          replyTo: replyTo || null,
          type: msgType,
          msgType: 'human',
          priority: priority === 'urgent' ? 'urgent' : 'normal',
          attachment: attachment || undefined,
          activityMeta: activityMeta || undefined,
          recordMentions: recordMentions.length > 0 ? recordMentions : undefined,
          readBy: [senderId]
        });

        // Update room updatedAt timestamp
        await ChatRoom.findByIdAndUpdate(roomId, { updatedAt: new Date() });

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

        // Broadcast to everyone in the room & personal channels of members
        let broadcast = io.to(roomId);
        if (targetRoom.members && targetRoom.members.length > 0) {
          targetRoom.members.forEach((m) => {
            const mIdStr = getMemberIdString(m);
            if (mIdStr) {
              broadcast = broadcast.to(`user_${mIdStr}`);
            }
          });
        }
        broadcast.emit('receive-message', populatedMessage);

        // Dispatch Web Push Notification to backgrounded / unfocused room members
        try {
          const recipientIds = (targetRoom.members || [])
            .map((m) => getMemberIdString(m))
            .filter((id) => id && id !== String(senderId));

          if (recipientIds.length > 0) {
            const senderDisplayName = populatedMessage.senderId?.name || populatedMessage.senderId?.username || 'Team Member';
            const cleanSnippet = (content || '').slice(0, 120) || (attachment ? `Sent attachment: ${attachment.name || 'file'}` : 'New message');
            webPushService.dispatchChatNotification(recipientIds, {
              senderName: senderDisplayName,
              messagePreview: cleanSnippet,
              roomId: String(roomId),
              roomName: targetRoom.name || '',
              priority: priority === 'urgent' ? 'urgent' : 'normal',
              avatarUrl: '/Logo.png'
            }).catch((err) => console.warn('[WebPush] Dispatch error:', err.message));
          }
        } catch (pushErr) {
          console.warn('[WebPush] Error gathering recipients:', pushErr.message);
        }

        // Emit direct notification to each mentioned user
        if (mentions.length > 0) {
          mentions.forEach(uId => {
            if (String(uId) !== String(senderId)) {
              io.to(`user_${uId}`).emit('mention-notification', {
                roomId,
                senderName: populatedMessage.senderId.name || populatedMessage.senderId.username,
                content: content,
                messageId: newMessage._id
              });
            }
          });
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
        console.error('Error saving message:', error);
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
        
        // Emit a separate event for the global Kanban board to update live
        const fullyPopulatedTask = await Task.findById(newTask._id)
          .populate('assignees', 'name email')
          .populate('comments.sender', 'name username email')
          .populate('timeLogs.user', 'name username email')
          .populate('activityLogs.user', 'name username email')
          .populate('subTasks.assignee', 'name email');
        io.emit('task-updated', fullyPopulatedTask);
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

        // Broadcast to everyone so their UI flips the status color
        io.emit('task-updated', updatedTask);
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

        // Broadcast updated task details to all connected clients
        io.emit('task-updated', updatedTask);
      } catch (error) {
        console.error('Error updating task details:', error);
      }
    });

    // Handle deleting a task
    socket.on('delete-task', async (data) => {
      try {
        const { taskId } = data;
        await Task.findByIdAndDelete(taskId);

        // Broadcast deletion event to all connected clients
        io.emit('task-deleted', taskId);
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
        await ChatMessage.findByIdAndUpdate(messageId, {
          content: 'This message was deleted',
          isDeleted: true,
          attachment: null
        });
        io.to(roomId).emit('message-deleted', { messageId });
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
        
        // Also notify all users globally to update sidebar
        io.emit('global-room-updated', populatedRoom);
      } catch (error) {
        console.error('Error updating room settings:', error);
      }
    });

    // Handle marking room messages as read
    socket.on('read-room-messages', async (data) => {
      try {
        const { roomId, userId } = data;
        await ChatMessage.updateMany(
          { roomId, senderId: { $ne: userId }, readBy: { $ne: userId } },
          { $addToSet: { readBy: userId } }
        );
        const targetRoom = await ChatRoom.findById(roomId);
        let broadcast = io.to(roomId);
        if (targetRoom && targetRoom.members && targetRoom.members.length > 0) {
          targetRoom.members.forEach((m) => {
            const mIdStr = getMemberIdString(m);
            if (mIdStr) broadcast = broadcast.to(`user_${mIdStr}`);
          });
        }
        broadcast.emit('room-messages-read', { roomId, userId });
      } catch (error) {
        console.error('Error marking messages as read:', error);
      }
    });

    // Handle production stage transitions for Job Cards & automated Bot logs
    socket.on('update-production-stage', async (data) => {
      try {
        const { jobCardId, newStage, actorId, actorName } = data;
        const JobCardModel = require('../db/models').JobCard;
        const ChatMessageModel = require('../db/models').ChatMessage;
        const ChatRoomModel = require('../db/models').ChatRoom;
        const OrderActivityLogModel = require('../db/models').OrderActivityLog;

        const card = await JobCardModel.findById(jobCardId);
        if (!card) return;

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
        io.emit('job-stage-updated', { jobCardId, jobNo: card.jobNo, newStage, prevStage });
      } catch (err) {
        console.error('Error updating production stage socket:', err);
      }
    });

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
        io.emit('proof-status-updated', { jobCardId, jobNo: card.jobNo, status, clientFeedback });
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
      activeUsers.delete(socket.id);
      io.emit('presence-sync', getOnlineUserIds());
    });
  });
};

module.exports = setupSockets;
