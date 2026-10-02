/**
 * ============================================================================
 * ELITE ERP ENTERPRISE - CIRCUIT BREAKER & HTTP KEEP-ALIVE CONNECTION POOL
 * Protects backend services against cascading third-party outages
 * (Myntra API, Uniware, AWS S3/Cloudflare R2, Notification Gateways).
 * ============================================================================
 */

const http = require('http');
const https = require('https');
const logger = require('../config/logger');

// Enterprise keep-alive pooling to eliminate TCP/TLS handshake overhead
const httpKeepAliveAgent = new http.Agent({
  keepAlive: true,
  maxSockets: 100,
  maxFreeSockets: 25,
  timeout: 60000,
});

const httpsKeepAliveAgent = new https.Agent({
  keepAlive: true,
  maxSockets: 100,
  maxFreeSockets: 25,
  timeout: 60000,
});

const CircuitState = {
  CLOSED: 'CLOSED',       // Normal operation
  OPEN: 'OPEN',           // Tripped — failing fast
  HALF_OPEN: 'HALF_OPEN', // Testing recovery with a single probe request
};

class CircuitBreaker {
  /**
   * @param {string} serviceName - Identifier for the external service
   * @param {object} [options={}]
   * @param {number} [options.failureThreshold=5] - Consecutive failures before opening
   * @param {number} [options.cooldownMs=30000] - Duration in ms to stay OPEN before HALF_OPEN probe
   * @param {number} [options.timeoutMs=10000] - Request timeout before counting as failure
   */
  constructor(serviceName, options = {}) {
    this.serviceName = serviceName;
    this.failureThreshold = options.failureThreshold || 5;
    this.cooldownMs = options.cooldownMs || 30000;
    this.timeoutMs = options.timeoutMs || 10000;

    this.state = CircuitState.CLOSED;
    this.failureCount = 0;
    this.successCount = 0;
    this.nextAttempt = Date.now();
  }

  /**
   * Executes a remote action guarded by the circuit breaker.
   * @param {Function} action - Async function to execute
   * @param {Function} [fallback] - Fallback function if circuit is OPEN or fails
   */
  async execute(action, fallback = null) {
    if (this.state === CircuitState.OPEN) {
      if (Date.now() > this.nextAttempt) {
        logger.info(`[CircuitBreaker:${this.serviceName}] Cooldown expired. Entering HALF_OPEN state.`);
        this.state = CircuitState.HALF_OPEN;
      } else {
        const error = new Error(`[CircuitBreaker:${this.serviceName}] Circuit is OPEN. Failing fast to prevent cascading degradation.`);
        error.code = 'CIRCUIT_BREAKER_OPEN';
        if (fallback) return fallback(error);
        throw error;
      }
    }

    try {
      // Execute action with timeout race
      const result = await Promise.race([
        action({ httpAgent: httpKeepAliveAgent, httpsAgent: httpsKeepAliveAgent }),
        new Promise((_, reject) =>
          setTimeout(() => {
            const timeoutErr = new Error(`[CircuitBreaker:${this.serviceName}] Request timed out after ${this.timeoutMs}ms`);
            timeoutErr.code = 'ETIMEDOUT';
            reject(timeoutErr);
          }, this.timeoutMs)
        ),
      ]);

      this.onSuccess();
      return result;
    } catch (err) {
      this.onFailure(err);
      if (fallback) {
        return fallback(err);
      }
      throw err;
    }
  }

  onSuccess() {
    this.failureCount = 0;
    if (this.state === CircuitState.HALF_OPEN) {
      this.successCount++;
      if (this.successCount >= 2) {
        this.state = CircuitState.CLOSED;
        this.successCount = 0;
        logger.info(`[CircuitBreaker:${this.serviceName}] Service successfully recovered. Circuit CLOSED.`);
      }
    }
  }

  onFailure(err) {
    this.failureCount++;
    logger.warn(`[CircuitBreaker:${this.serviceName}] Failure recorded (${this.failureCount}/${this.failureThreshold}): ${err.message}`);

    if (this.state === CircuitState.HALF_OPEN || this.failureCount >= this.failureThreshold) {
      this.state = CircuitState.OPEN;
      this.nextAttempt = Date.now() + this.cooldownMs;
      logger.error(`[CircuitBreaker:${this.serviceName}] Threshold reached! Circuit OPEN until ${new Date(this.nextAttempt).toISOString()}`);
    }
  }

  getState() {
    return {
      service: this.serviceName,
      state: this.state,
      failureCount: this.failureCount,
      nextAttempt: this.nextAttempt,
    };
  }
}

// Service registry
const breakers = new Map();

function getCircuitBreaker(serviceName, options = {}) {
  if (!breakers.has(serviceName)) {
    breakers.set(serviceName, new CircuitBreaker(serviceName, options));
  }
  return breakers.get(serviceName);
}

module.exports = {
  CircuitBreaker,
  getCircuitBreaker,
  CircuitState,
  httpKeepAliveAgent,
  httpsKeepAliveAgent,
};
