module.exports = {
  apps: [
    {
      name: "keeper",
      script: "npx",
      args: "tsx src/index.ts",
      cwd: __dirname,
      // Restart policy
      autorestart: true,
      max_restarts: 10,
      min_uptime: "10s",
      restart_delay: 5000,
      // Logs
      log_date_format: "YYYY-MM-DD HH:mm:ss",
      error_file: "logs/keeper-error.log",
      out_file: "logs/keeper-out.log",
      merge_logs: true,
      // Memory limit — restart if exceeded
      max_memory_restart: "256M",
      // Environment
      env: {
        NODE_ENV: "production",
      },
    },
  ],
};
