const { ChatMessage, Task, User } = require('../db/models');

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

    // Handle sending a standard text message
    socket.on('send-message', async (data) => {
      try {
        const { roomId, senderId, content } = data;
        
        // Save message to MongoDB
        const newMessage = await ChatMessage.create({
          roomId,
          senderId,
          content,
          type: 'text'
        });

        const populatedMessage = await ChatMessage.findById(newMessage._id).populate('senderId', 'username email');

        // Broadcast to everyone in the room (including sender)
        io.to(roomId).emit('receive-message', populatedMessage);
      } catch (error) {
        console.error('Error saving message:', error);
      }
    });

    // Handle creating a task directly from the chat stream
    socket.on('create-task-from-chat', async (data) => {
      try {
        const { roomId, senderId, content, title, priority, assignees, dueDate } = data;

        // 1. Save the Task to MongoDB
        const newTask = await Task.create({
          title,
          description: content,
          priority: priority || 'medium',
          status: 'To Do',
          originRoomId: roomId || undefined,
          assignees: assignees || [],
          dueDate: dueDate || undefined,
        });

        if (roomId) {
          // 2. Save a special "task-card" message in the chat timeline
          const newMessage = await ChatMessage.create({
            roomId,
            senderId,
            content: 'Task Created', // Fallback text
            type: 'task-card',
            taskId: newTask._id,
          });

          // 3. Populate and broadcast the interactive card
          const populatedMessage = await ChatMessage.findById(newMessage._id)
            .populate('senderId', 'username email')
            .populate({
              path: 'taskId',
              populate: { path: 'assignees', select: 'username email' }
            });

          io.to(roomId).emit('receive-message', populatedMessage);
        }
        
        // Emit a separate event for the global Kanban board to update live
        const fullyPopulatedTask = await Task.findById(newTask._id).populate('assignees', 'username email');
        io.emit('task-updated', fullyPopulatedTask);
      } catch (error) {
        console.error('Error creating task from chat:', error);
      }
    });

    // Handle updating a task status interactively from inside the chat card
    socket.on('update-task-status', async (data) => {
      try {
        const { taskId, newStatus } = data;
        
        const updatedTask = await Task.findByIdAndUpdate(
          taskId,
          { status: newStatus },
          { new: true }
        ).populate('assignees', 'username email');

        // Broadcast to everyone so their UI flips the status color
        io.emit('task-updated', updatedTask);
      } catch (error) {
        console.error('Error updating task status:', error);
      }
    });

    socket.on('disconnect', () => {
      console.log(`User disconnected from socket: ${socket.id}`);
    });
  });
};

module.exports = setupSockets;
