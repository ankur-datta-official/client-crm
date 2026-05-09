module.exports = {
  apps: [
    {
      name: "crm-next",
      script: "npm",
      args: "start -- -p 3001",
      cwd: "/home/crm.mugnee.com/app",
      instances: 1,
      exec_mode: "fork",
      autorestart: true,
      max_restarts: 10,
      min_uptime: "10s",
      env: {
        NODE_ENV: "production",
      },
    },
  ],
};
