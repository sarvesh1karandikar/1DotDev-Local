// PM2 ecosystem config for 1DotDev local WSL deployment.
// Copy to: /home/sskgameon/sarvesh1karandikar/1DotDev/infra/pm2/ecosystem.config.cjs
//
// Usage:
//   pm2 start ecosystem.config.cjs
//   pm2 save
//   pm2 startup   (follow the printed sudo command)

const BRIDGE_DIR = "/home/sskgameon/sarvesh1karandikar/1DotDev/bridge";

module.exports = {
  apps: [
    {
      name: "1dotdev-bridge",
      script: `${BRIDGE_DIR}/server.js`,
      cwd: BRIDGE_DIR,
      interpreter: "node",
      interpreter_args: "",
      env_file: `${BRIDGE_DIR}/.env`,
      restart_delay: 5000,
      max_restarts: 20,
      watch: false,
      log_date_format: "YYYY-MM-DD HH:mm:ss",
      error_file: `${BRIDGE_DIR}/../logs/bridge-error.log`,
      out_file: `${BRIDGE_DIR}/../logs/bridge-out.log`,
      merge_logs: true,
    },
    // Optional: let PM2 also manage the ngrok tunnel.
    // Uncomment and set NGROK_DOMAIN to your free static domain.
    // {
    //   name: "1dotdev-ngrok",
    //   script: "ngrok",
    //   args: "http 3000 --domain=<your-static-domain>",
    //   interpreter: "none",
    //   autorestart: true,
    //   watch: false,
    // },
  ],
};
