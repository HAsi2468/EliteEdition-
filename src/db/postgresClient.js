/**
 * PostgreSQL Database Client & Connection Pool Provider
 * Manages connection pooling, transaction execution, and health checks for the Race Condition Engine.
 */

let pg;
try {
  pg = require('pg');
} catch (e) {
  // Graceful fallback if pg package is not yet installed in the current environment
  pg = null;
}

const { Pool } = pg || {};

let poolInstance = null;

function getPgPool() {
  if (poolInstance) {
    return poolInstance;
  }

  if (!pg) {
    // Return an in-memory/mock client provider for test execution if pg is omitted
    return {
      query: async (text, params) => {
        throw new Error('PostgreSQL driver (pg) is not installed. Run `npm install pg` to connect to PostgreSQL.');
      },
      connect: async () => {
        throw new Error('PostgreSQL driver (pg) is not installed. Run `npm install pg` to connect to PostgreSQL.');
      }
    };
  }

  const connectionString = process.env.DATABASE_URL || process.env.POSTGRES_URL;

  const poolConfig = connectionString
    ? {
        connectionString,
        max: parseInt(process.env.PG_MAX_POOL || '20', 10),
        idleTimeoutMillis: 30000,
        connectionTimeoutMillis: 5000
      }
    : {
        host: process.env.PGHOST || '127.0.0.1',
        port: parseInt(process.env.PGPORT || '5432', 10),
        user: process.env.PGUSER || 'postgres',
        password: process.env.PGPASSWORD || 'postgres',
        database: process.env.PGDATABASE || 'elite_erp',
        max: parseInt(process.env.PG_MAX_POOL || '20', 10),
        idleTimeoutMillis: 30000,
        connectionTimeoutMillis: 5000
      };

  poolInstance = new Pool(poolConfig);

  poolInstance.on('error', (err) => {
    console.error('[PostgreSQL Pool Error] Unexpected client error:', err);
  });

  return poolInstance;
}

/**
 * Execute a query directly against the pool.
 */
async function query(text, params) {
  const pool = getPgPool();
  return pool.query(text, params);
}

/**
 * Execute a unit of work inside a managed transaction.
 * Automatically issues BEGIN, COMMIT, or ROLLBACK.
 */
async function withTransaction(fn) {
  const pool = getPgPool();
  const client = await pool.connect();

  try {
    await client.query('BEGIN');
    const result = await fn(client);
    await client.query('COMMIT');
    return result;
  } catch (err) {
    try {
      await client.query('ROLLBACK');
    } catch (rollbackErr) {
      console.error('[PostgreSQL Rollback Error]:', rollbackErr);
    }
    throw err;
  } finally {
    client.release();
  }
}

module.exports = {
  getPgPool,
  query,
  withTransaction
};
