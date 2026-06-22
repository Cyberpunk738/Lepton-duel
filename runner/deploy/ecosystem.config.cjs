module.exports = {
  apps: [
    {
      name: "dirac-runner",
      cwd: "/opt/dirac/runner",
      script: "./node_modules/.bin/tsx",
      args: "src/index.ts",
      interpreter: "none",
      autorestart: true,
      restart_delay: 5000,
      max_memory_restart: "300M",
      env: {
        NODE_ENV: "production",
        VARA_WALLET: "/usr/local/bin/vara-wallet",
      },
    },
  ],
};
