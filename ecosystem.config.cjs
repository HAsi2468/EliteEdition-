/**
 * Enterprise PM2 Ecosystem Configuration for Elite Edition ERP
 * 
 * Production-Hardened Cluster Mode with Zero-Downtime Reloading,
 * Exponential Backoff Restart Delay, and Memory Leak Mitigation.
 */

module.exports = {
  apps: [
    {
      name: 'elite-backend',
      script: 'src/index.js',
      cwd: process.env.PM2_CWD || '/home/ubuntu/EliteEditionMongo',

      // Scaling: Runs 2 cluster workers across 2 vCPUs for parallel auth & event loop resilience
      instances: process.env.PM2_INSTANCES ? parseInt(process.env.PM2_INSTANCES, 10) : 2,
      exec_mode: 'cluster',

      // Zero-Downtime Reload & Handshake Controls
      wait_ready: true,            // Pauses PM2 until worker signals readiness
      listen_timeout: 12000,       // Max ms to wait for the new worker to listen
      kill_timeout: 6000,          // Grace period for active sockets/requests to close cleanly
      shutdown_with_message: true, // Enables IPC message shutdown sequence

      // Memory Safeguards (Calibrated for 4GB RAM instance: 2 workers x 850MB = ~1.7GB max heap, leaving 2GB+ free)
      node_args: '--max-old-space-size=768',
      max_memory_restart: '850M',  // Prevents worker recycles during heavy PDF/Excel/200+ socket loads
      exp_backoff_restart_delay: 200, // Exponential backoff prevents CPU pegging on crash loops
      max_restarts: 15,            // Guards against infinite restart loops
      min_uptime: '10s',           // Deems app healthy if it runs uninterrupted for 10s

      // Logging & Diagnostics
      time: true,                  // Prepends ISO timestamps to all log lines
      merge_logs: true,            // Merges cluster instance logs for unified inspection
      error_file: '/home/ubuntu/.pm2/logs/elite-backend-error.log',
      out_file: '/home/ubuntu/.pm2/logs/elite-backend-out.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss.SSS Z',

      // Default Environment Variables
      env: {
        NODE_ENV: 'production',
        HOST: '127.0.0.1',
        PORT: 3001,
        REDIS_HOST: '127.0.0.1',
        REDIS_PORT: 6379,
        UV_THREADPOOL_SIZE: 64
      },

      // Production Environment Variables
      env_production: {
        NODE_ENV: 'production',
        HOST: '127.0.0.1',
        PORT: 3001,
        REDIS_HOST: '127.0.0.1',
        REDIS_PORT: 6379,
        UV_THREADPOOL_SIZE: 64     // Expands libuv threadpool for sharp image processing & crypto
      },

      // Staging / Testing Environment Variables
      env_staging: {
        NODE_ENV: 'staging',
        HOST: '127.0.0.1',
        PORT: 3002,
        REDIS_HOST: '127.0.0.1',
        REDIS_PORT: 6379,
        UV_THREADPOOL_SIZE: 8
      }
    }
  ]
};
