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

const port = 3001; // forced port to avoid conflict
server.listen(port, '0.0.0.0', () => {
  logger.info(`App is listening on port ${port}`);
  console.log('Server bound to', server.address());
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
