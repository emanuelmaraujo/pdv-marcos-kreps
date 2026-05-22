module.exports = {
  apps: [
    {
      name: 'pdv-print-worker',
      script: 'npm',
      args: 'run start',
      cwd: '/home/pi/pdv-marcos-kreps/print-worker',
      restart_delay: 5000,
      max_restarts: 50,
      min_uptime: '10s',
      watch: false,
      env: {
        NODE_ENV: 'production',
      },
    },
  ],
};
