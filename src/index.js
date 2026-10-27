// Expand libuv worker threadpool immediately before any async I/O or crypto modules initialize
if (!process.env.UV_THREADPOOL_SIZE) {
  process.env.UV_THREADPOOL_SIZE = '64';
}

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

// Initialize Socket.io with production-grade stability, long-lived heartbeat, and compression
const io = new Server(server, {
  pingTimeout: 30000,   // 30s timeout allows background tabs and network jitter to stay alive without dropping
  pingInterval: 25000,  // Heartbeat check every 25s
  connectTimeout: 20000,
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
    const redisUrl = process.env.REDIS_URL || `redis://${process.env.REDIS_HOST || '127.0.0.1'}:${process.env.REDIS_PORT || 6379}`;
    const pubClient = createClient({ url: redisUrl });
    const subClient = pubClient.duplicate();

    pubClient.on('error', (err) => logger.warn(`[Redis Adapter] PubClient error: ${err.message}`));
    subClient.on('error', (err) => logger.warn(`[Redis Adapter] SubClient error: ${err.message}`));

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

// Start automated daily database backup & overdue task timer on primary cluster instance only
const isPrimaryInstance = !process.env.NODE_APP_INSTANCE || process.env.NODE_APP_INSTANCE === '0';
if (isPrimaryInstance) {
  startDbBackupScheduler();
  setInterval(() => {
    checkOverdueTasks(io).catch(err => console.error('Overdue timer check failed:', err));
  }, 60000);
}

const port = process.env.PORT || 3001;
const host = process.env.HOST || '127.0.0.1';
server.listen(port, host, async () => {
  logger.info(`App is listening on primary port ${port} on ${host}`);
  console.log('Server bound to', server.address());

  await syncCommunicationGroups();
  const { seedFacilitiesOnStartup } = require('./controllers/facility.controller');
  await seedFacilitiesOnStartup();

  if (typeof process.send === 'function') {
    process.send('ready');
  }

  process.on('message', (packet) => {
    try {
      if (packet === 'shutdown' || packet?.type === 'shutdown') {
        logger.info('PM2 graceful shutdown IPC received. Draining connections...');
        exitHandler(0);
        return;
      }
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
    try {
      if (io && typeof io.disconnectSockets === 'function') {
        io.disconnectSockets(true);
      }
    } catch (_) {}

    server.close(() => {
      logger.info('Server closed gracefully');
      process.exit(code);
    });
    setTimeout(() => {
      process.exit(code);
    }, 4000).unref();
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
