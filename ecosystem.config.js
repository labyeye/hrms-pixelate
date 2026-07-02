module.exports = {
  apps: [
    {
      name: "hrms-backend",
      cwd: "./backend",
      script: "server.js",
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
