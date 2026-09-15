const dns = require('dns');
if (typeof dns.setDefaultResultOrder === 'function') {
  dns.setDefaultResultOrder('ipv4first');
}
const http = require('http');
const { Server } = require('socket.io');
const app = require('./app');
const models = require('./db/models');
const config = require('./config/config');
const logger = require('./config/logger');
const setupSockets = require('./sockets');

const server = http.Server(app);

// Initialize Socket.io
const io = new Server(server, {
  pingTimeout: 5000,   // Gracefully disconnect clients taking >5s to respond
  pingInterval: 10000, // Check heartbeat every 10s
  cors: {
    origin: '*', // Allows connections from any origin for now
    methods: ['GET', 'POST']
  }
});
setupSockets(io);
app.set('socketio', io);

const { syncCommunicationGroups } = require('./utils/syncCommunicationGroups');
const { checkOverdueTasks } = require('./controllers/task.controller');

// Run overdue task check every 60 seconds
setInterval(() => {
  checkOverdueTasks(io).catch(err => console.error('Overdue timer check failed:', err));
}, 60000);

const port = process.env.PORT || 3001;
server.listen(port, '0.0.0.0', async () => {
  logger.info(`App is listening on primary port ${port}`);
  console.log('Server bound to', server.address());

  if (Number(port) !== 3000) {
    try {
      const server3000 = http.Server(app);
      const io3000 = new Server(server3000, { cors: { origin: '*' } });
      setupSockets(io3000);
      server3000.listen(3000, '0.0.0.0', () => console.log('Fallback server listening on port 3000'));
    } catch(e) {
      console.warn('Could not bind fallback port 3000:', e.message);
    }
  }

  try {
    const server80 = http.Server(app);
    const io80 = new Server(server80, { cors: { origin: '*' } });
    setupSockets(io80);
    server80.listen(80, '0.0.0.0', () => console.log('HTTP server listening on port 80'));
  } catch(e) {
    console.warn('Could not bind port 80:', e.message);
  }

  await syncCommunicationGroups();
});

// const exitHandler = () => {
// 	if (server) {
// 		server.close(() => {
// 			logger.info('Server closed');
// 			process.exit(1);
// 		});
// 	} else {
// 		process.exit(1);
// 	}
// };

const unexpectedErrorHandler = (error) => {
  logger.error(error);
  // exitHandler();
};

process.on('uncaughtException', unexpectedErrorHandler);
process.on('unhandledRejection', unexpectedErrorHandler);

process.on('SIGTERM', () => {
  logger.info('SIGTERM received');
  if (server) {
    server.close();
  }
});
