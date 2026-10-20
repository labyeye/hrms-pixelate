module.exports = {
  apps: [
    {
      name: "hrms-backend",
      cwd: "./backend",
      script: "server.js",
      // Cluster mode: one worker per core slot. 4 workers handle ~4x the concurrent HR users of a single Node process
      // (the hourly attendance cron only runs on worker 0, see backend/server.js).
      instances: 4,
      exec_mode: "cluster",
      env: {
        NODE_ENV: "production",
      },
    },
    {
      name: "hrms-face-service",
      cwd: "./face-service",
      script: "venv/bin/uvicorn",
      args: "main:app --host 127.0.0.1 --port 8091",
      interpreter: "none",
      env: {
        FACE_SERVICE_API_KEY: "CHANGE_ME",
      },
    },
  ],
};
