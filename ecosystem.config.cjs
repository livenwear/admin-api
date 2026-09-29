const path = require('path');

const appName = process.env.PM2_APP_NAME || 'liven-api';
const logsDir = path.join(__dirname, 'logs');

module.exports = {
  apps: [
    {
      name: appName,
      script: 'dist/main.js',
      cwd: __dirname,
      instances: 1,
      exec_mode: 'fork',
      watch: false,
      max_memory_restart: '500M',
      // Stable paths so GET /mylog can always find the last N lines
      out_file: path.join(logsDir, 'out.log'),
      error_file: path.join(logsDir, 'error.log'),
      merge_logs: true,
      time: true,
      env: {
        NODE_ENV: 'production',
      },
    },
  ],
};
