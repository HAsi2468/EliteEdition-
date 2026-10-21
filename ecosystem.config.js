module.exports = {
  apps: [
    {
      name: 'elite-backend',
      script: 'src/index.js',
      instances: 2,
      exec_mode: 'cluster',
      wait_ready: true,
      listen_timeout: 10000,
      kill_timeout: 5000,
      max_memory_restart: '1G',
      env: {
        NODE_ENV: 'production',
        PORT: 3001,
        REDIS_HOST: '127.0.0.1',
        REDIS_PORT: 6379
      }
    }
  ]
};
