// Offline checks for data-exposure fixes: public /uploads allow-list, WhatsApp webhook verification/signature,
// stats-key handling. No database: buffering is off, anything that reaches a query fails fast with a 500.
//   node scripts/check-exposure.js
process.env.META_WA_VERIFY_TOKEN = "verify-me";
process.env.META_WA_APP_SECRET = "app-secret";
process.env.CRM_API_SECRET = "crm-secret";
const fs = require("fs");
const os = require("os");
const path = require("path");
const http = require("http");
const crypto = require("crypto");
const express = require("express");
const mongoose = require("mongoose");
mongoose.set("bufferCommands", false);

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "uploads-"));
for (const d of ["employee-aadhaar", "employee-pan", "leave-docs", "employee-docs", "avatars", "company-logos", "attendance-selfies"]) {
  fs.mkdirSync(path.join(tmp, d));
  fs.writeFileSync(path.join(tmp, d, "x.png"), "data");
}

const app = express();
app.use(express.json({ verify: (req, _res, buf) => { if (req.originalUrl.includes("whatsapp-webhook")) req.rawBody = buf; } }));
app.use("/uploads", ...require("../middleware/publicUploads")(tmp));
app.use("/api/whatsapp-webhook", require("../routes/whatsappWebhookRoutes"));
app.use("/internal/stats", require("../routes/statsRoutes"));

const req = (port, method, p, { headers = {}, body } = {}) =>
  new Promise((resolve) => {
    const r = http.request({ port, method, path: p, headers }, (res) => {
      let data = "";
      res.on("data", (c) => (data += c));
      res.on("end", () => resolve({ status: res.statusCode, headers: res.headers, data }));
    });
    r.end(body);
  });

const server = app.listen(0, async () => {
  const port = server.address().port;
  let bad = 0;
  const check = (name, ok, extra = "") => {
    if (!ok) bad++;
    console.log(`${ok ? "ok  " : "FAIL"} ${name} ${extra}`);
  };

  for (const d of ["employee-aadhaar", "employee-pan", "leave-docs", "employee-docs"]) {
    const r = await req(port, "GET", `/uploads/${d}/x.png`);
    check(`/uploads/${d} is not public`, r.status === 404, `-> ${r.status}`);
  }
  for (const d of ["avatars", "company-logos", "attendance-selfies"]) {
    const r = await req(port, "GET", `/uploads/${d}/x.png`);
    check(`/uploads/${d} stays public`, r.status === 200 && r.headers["x-content-type-options"] === "nosniff", `-> ${r.status}`);
  }
  check("directory traversal blocked", (await req(port, "GET", "/uploads/avatars/..%2Femployee-aadhaar%2Fx.png")).status !== 200);

  const ok = await req(port, "GET", "/api/whatsapp-webhook?hub.mode=subscribe&hub.verify_token=verify-me&hub.challenge=123");
  check("webhook handshake with the right token", ok.status === 200 && ok.data === "123");
  check("webhook handshake with a wrong token", (await req(port, "GET", "/api/whatsapp-webhook?hub.mode=subscribe&hub.verify_token=nope&hub.challenge=1")).status === 403);
  check("old hard-coded verify token no longer works", (await req(port, "GET", "/api/whatsapp-webhook?hub.mode=subscribe&hub.verify_token=nesthr_verify_token&hub.challenge=1")).status === 403);

  const payload = JSON.stringify({ entry: [] });
  const sig = "sha256=" + crypto.createHmac("sha256", "app-secret").update(payload).digest("hex");
  const json = { "Content-Type": "application/json" };
  check("unsigned webhook POST rejected", (await req(port, "POST", "/api/whatsapp-webhook", { headers: json, body: payload })).status === 401);
  check("badly signed webhook POST rejected", (await req(port, "POST", "/api/whatsapp-webhook", { headers: { ...json, "x-hub-signature-256": "sha256=" + "0".repeat(64) }, body: payload })).status === 401);
  check("correctly signed webhook POST accepted", (await req(port, "POST", "/api/whatsapp-webhook", { headers: { ...json, "x-hub-signature-256": sig }, body: payload })).status === 200);

  check("stats key in the query string is refused", (await req(port, "GET", "/internal/stats?key=crm-secret")).status === 401);
  check("stats with a wrong header is refused", (await req(port, "GET", "/internal/stats", { headers: { "x-stats-key": "x" } })).status === 401);
  check("stats with the right header gets past the guard", (await req(port, "GET", "/internal/stats", { headers: { "x-stats-key": "crm-secret" } })).status !== 401);

  fs.rmSync(tmp, { recursive: true, force: true });
  console.log(bad ? `\n${bad} FAILED` : "\nall exposure checks passed");
  server.close(() => process.exit(bad ? 1 : 0));
});
