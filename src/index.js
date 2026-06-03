const dns = require('dns');
if (typeof dns.setDefaultResultOrder === 'function') {
  dns.setDefaultResultOrder('ipv4first');
}
const http = require('http');
const app = require('./app');
const models = require('./db/models');
const config = require('./config/config');
const logger = require('./config/logger');

const server = http.Server(app);

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
