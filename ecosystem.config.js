module.exports = {
  apps: [
    {
      name: 'elite-backend',
      script: 'src/index.js',
      instances: 1,
      exec_mode: 'fork',
      wait_ready: true,
      listen_timeout: 10000,
      kill_timeout: 5000,
      env: {
        NODE_ENV: 'production',
        PORT: 3001
      }
    }
  ]
};
