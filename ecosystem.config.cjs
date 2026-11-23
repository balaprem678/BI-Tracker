module.exports = {
  apps: [
    {
      name: "bitracker",
      script: ".output/server/index.mjs",
      node_args: "--env-file=.env",
      env: {
        PORT: 3002,
        NODE_ENV: "production",
      },
    },
  ],
};
