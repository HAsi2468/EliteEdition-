/**
 * ============================================================================
 * ELITE ERP ENTERPRISE - STRUCTURED WINSTON LOGGER
 * High-performance JSON logging with correlation IDs, timestamps,
 * execution duration, and sanitized error metadata.
 * ============================================================================
 */

const winston = require('winston');
const config = require('./config');

const enumerateErrorFormat = winston.format((info) => {
  if (info instanceof Error) {
    Object.assign(info, {
      message: info.message,
      stack: info.stack,
      code: info.code,
      statusCode: info.statusCode,
    });
  }
  return info;
});

// Production: Pure JSON format for CloudWatch / Datadog / ELK ingestion
const productionFormat = winston.format.combine(
  enumerateErrorFormat(),
  winston.format.splat(),
  winston.format.timestamp({ format: 'YYYY-MM-DDTHH:mm:ss.SSSZ' }),
  winston.format.json()
);

// Development: Readable colorized format
const developmentFormat = winston.format.combine(
  enumerateErrorFormat(),
  winston.format.colorize(),
  winston.format.timestamp({ format: 'HH:mm:ss' }),
  winston.format.splat(),
  winston.format.printf(({ timestamp, level, message, requestId, durationMs, ...meta }) => {
    const reqStr = requestId ? ` [Req: ${requestId}]` : '';
    const durStr = durationMs !== undefined ? ` [${durationMs}ms]` : '';
    const metaStr = Object.keys(meta).length ? ` ${JSON.stringify(meta)}` : '';
    return `${timestamp} ${level}:${reqStr}${durStr} ${message}${metaStr}`;
  })
);

const logger = winston.createLogger({
  level: config.env === 'development' ? 'debug' : 'info',
  format: config.env === 'production' ? productionFormat : developmentFormat,
  defaultMeta: { service: 'elite-edition-backend' },
  transports: [
    new winston.transports.Console({
      stderrLevels: ['error'],
    }),
  ],
});

module.exports = logger;
