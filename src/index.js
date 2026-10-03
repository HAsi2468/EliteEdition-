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

const eventBus = require('./services/eventBus.service');

// Initialize Socket.io with high-resilience mobile & desktop heartbeat and compression
const io = new Server(server, {
  pingTimeout: 20000,   // Resilient timeout against cellular handover and background tabs
  pingInterval: 25000,  // Heartbeat check every 25s
  transports: ['websocket', 'polling'],
  perMessageDeflate: {
    threshold: 1024     // Enable compression for payloads above 1KB
  },
  cors: {
    origin: '*',
    methods: ['GET', 'POST'],
    credentials: true
  }
});

// Attach event bus
eventBus.setSocketIo(io);

// Optional Redis adapter attachment for multi-process PM2 cluster synchronization
if (process.env.REDIS_URL || process.env.REDIS_HOST) {
  try {
    const { createAdapter } = require('@socket.io/redis-adapter');
    const { createClient } = require('redis');
    const pubClient = createClient({ url: process.env.REDIS_URL || `redis://${process.env.REDIS_HOST || 'localhost'}:6379` });
    const subClient = pubClient.duplicate();
    Promise.all([pubClient.connect(), subClient.connect()]).then(() => {
      io.adapter(createAdapter(pubClient, subClient));
      logger.info('Attached Redis adapter to Socket.IO for multi-instance cluster synchronization');
    }).catch(err => {
      logger.warn('Redis adapter connection failed, running with in-process event bus: ' + err.message);
    });
  } catch (err) {
    logger.info('Redis adapter not loaded; running with in-memory event bus');
  }
}

setupSockets(io);
app.set('socketio', io);
app.set('io', io);
global.io = io;

const { syncCommunicationGroups } = require('./utils/syncCommunicationGroups');
const { checkOverdueTasks } = require('./controllers/task.controller');
const { startDbBackupScheduler } = require('./schedule/dbBackupScheduler');

// Start automated daily database backup to Cloudflare R2
startDbBackupScheduler();

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
      server3000.on('error', (err) => {
        console.warn('Could not bind fallback port 3000 (handled):', err.message);
      });
      const io3000 = new Server(server3000, { cors: { origin: '*' } });
      setupSockets(io3000);
      server3000.listen(3000, '0.0.0.0', () => console.log('Fallback server listening on port 3000'));
    } catch(e) {
      console.warn('Could not bind fallback port 3000:', e.message);
    }
  }

  try {
    const server80 = http.Server(app);
    server80.on('error', (err) => {
      console.warn('Could not bind port 80 (handled):', err.message);
    });
    const io80 = new Server(server80, { cors: { origin: '*' } });
    setupSockets(io80);
    server80.listen(80, '0.0.0.0', () => console.log('HTTP server listening on port 80'));
  } catch(e) {
    console.warn('Could not bind port 80:', e.message);
  }

  await syncCommunicationGroups();
  const { seedFacilitiesOnStartup } = require('./controllers/facility.controller');
  await seedFacilitiesOnStartup();

  if (typeof process.send === 'function') {
    process.send('ready');
  }

  process.on('message', (packet) => {
    try {
      if (packet && (packet.type === 'broadcast-version-update' || packet.action === 'broadcast-version-update')) {
        const payload = packet.data || {
          version: 1791022781512,
          releaseVersion: 'v2.8.0',
          releaseName: 'v2.8.0 — Job Card Print Sheet & Production Suite',
          timestamp: Date.now()
        };
        const activeIo = app.get('io') || app.get('socketio') || global.io;
        if (activeIo) {
          activeIo.emit('app-version-updated', payload);
          logger.info('[IPC] Broadcasted app-version-updated to socket clients: %s', payload.releaseVersion || payload.version);
        }
      }
    } catch (ipcErr) {
      logger.warn('[IPC] Error handling message: %s', ipcErr.message);
    }
  });
});

const exitHandler = (code = 1) => {
  if (server) {
    server.close(() => {
      logger.info('Server closed gracefully');
      process.exit(code);
    });
    setTimeout(() => {
      process.exit(code);
    }, 5000).unref();
  } else {
    process.exit(code);
  }
};

const unexpectedErrorHandler = (error) => {
  logger.error('CRITICAL UNHANDLED ERROR:', error);
  if (config.env === 'production') {
    exitHandler(1);
  }
};

process.on('uncaughtException', unexpectedErrorHandler);
process.on('unhandledRejection', unexpectedErrorHandler);

process.on('SIGTERM', () => {
  logger.info('SIGTERM received');
  exitHandler(0);
});

process.on('SIGINT', () => {
  logger.info('SIGINT received');
  exitHandler(0);
});
