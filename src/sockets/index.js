const { ChatMessage, Task, User } = require('../db/models');

const activeUsers = new Map(); // socket.id -> userId
const getOnlineUserIds = () => {
  return Array.from(new Set(activeUsers.values()));
};

const setupSockets = (io) => {
  // Middleware for Socket Auth can go here
  // io.use((socket, next) => { ... });

  io.on('connection', (socket) => {
    console.log(`User connected to socket: ${socket.id}`);

    // Join a specific organization or department room
    socket.on('join-room', (roomId) => {
      socket.join(roomId);
      console.log(`Socket ${socket.id} joined room ${roomId}`);
    });

    // Register user to their personal socket channel for direct messaging notifications
    socket.on('register-user', (userId) => {
      socket.join(`user_${userId}`);
      console.log(`Socket ${socket.id} joined personal room user_${userId}`);
      activeUsers.set(socket.id, userId);
      socket.userId = userId;
      io.emit('presence-sync', getOnlineUserIds());
    });

    // Handle sending a standard text message (supports quoted replies, attachments, mentions)
    socket.on('send-message', async (data) => {
      try {
        const { roomId, senderId, content, replyTo, attachment } = data;
        
        // Parse mentions
        const mentionRegex = /@(\w+)/g;
        const matches = [...content.matchAll(mentionRegex)];
        const usernames = matches.map(m => m[1]);
        const mentions = [];
        if (usernames.length > 0) {
          const matchedUsers = await User.find({ username: { $in: usernames } });
          matchedUsers.forEach(u => mentions.push(u._id));
        }

        // Save message to MongoDB
        const newMessage = await ChatMessage.create({
          roomId,
          senderId,
          content,
          replyTo: replyTo || null,
          type: 'text',
          attachment: attachment || undefined,
          mentions: mentions,
          readBy: [senderId]
        });

        const populatedMessage = await ChatMessage.findById(newMessage._id)
          .populate('senderId', 'name username email')
          .populate({
            path: 'reactions.user',
            select: 'name username email'
          })
          .populate({
            path: 'replyTo',
            populate: { path: 'senderId', select: 'name username email' }
          })
          .populate('mentions', 'name username email');

        // Broadcast to everyone in the room (including sender)
        io.to(roomId).emit('receive-message', populatedMessage);

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
        io.to(roomId).emit('room-messages-read', { roomId, userId });
      } catch (error) {
        console.error('Error marking messages as read:', error);
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
