#!/usr/bin/env node
// NestHR Hikvision site agent. Run on any always-on PC on the SAME network as the terminal.
// It only makes outbound HTTPS calls to NestHR: no VPN, no port-forwarding.
//
//   HRMS_TOKEN=<agent token from NestHR>  DEVICE_HOST=192.168.1.32  DEVICE_USER=admin  DEVICE_PASS=xxxx  node agent.js
//
// Optional: HRMS_SERVER (default https://hrms-backend.pixelatenest.com), DEVICE_PORT (80), DEVICE_HTTPS=1, POLL_SECONDS (10)
const { testDevice, pushUser, pushFace } = require("./isapi");

const env = process.env;
const server = (env.HRMS_SERVER || "https://hrms-backend.pixelatenest.com").replace(/\/$/, "");
const dev = {
  host: env.DEVICE_HOST,
  port: Number(env.DEVICE_PORT) || undefined,
  https: env.DEVICE_HTTPS === "1",
  username: env.DEVICE_USER || "admin",
  password: env.DEVICE_PASS,
};
if (!env.HRMS_TOKEN || !dev.host || !dev.password) {
  console.error("Set HRMS_TOKEN, DEVICE_HOST and DEVICE_PASS (see top of agent.js).");
  process.exit(1);
}
const base = `${server}/api/attendance/hikvision-agent/${env.HRMS_TOKEN}/jobs`;
const log = (m) => console.log(`[${new Date().toISOString()}] ${m}`);

async function runJob(j) {
  const emp = { employeeId: j.employeeId, firstName: j.name, lastName: "" };
  if (j.type === "user") return pushUser(dev, emp);
  if (j.type === "face") return pushFace(dev, emp, Buffer.from(j.image || "", "base64"));
  throw new Error(`unknown job type ${j.type}`);
}

async function tick() {
  const r = await fetch(base);
  if (r.status === 401) throw new Error("NestHR rejected the token (regenerate it in the Biometric page)");
  if (!r.ok) throw new Error(`NestHR error HTTP ${r.status}`);
  const { jobs = [] } = await r.json();
  for (const j of jobs) {
    let result;
    try {
      await runJob(j);
      result = { ok: true };
      log(`${j.type} ${j.employeeId}: done`);
    } catch (e) {
      result = { ok: false, error: e.message };
      log(`${j.type} ${j.employeeId}: FAILED ${e.message}`);
    }
    await fetch(`${base}/${j._id}/result`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(result) });
  }
}

(async () => {
  try {
    log(`Device OK: ${await testDevice(dev)}`);
  } catch (e) {
    log(`Cannot reach device yet: ${e.message}`);
  }
  if (env.ONCE) return tick().catch((e) => { log(e.message); process.exit(1); });
  for (;;) {
    await tick().catch((e) => log(e.message));
    await new Promise((r) => setTimeout(r, (Number(env.POLL_SECONDS) || 10) * 1000));
  }
})();
