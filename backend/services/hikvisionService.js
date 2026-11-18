// Outbound push to a Hikvision access terminal over ISAPI (digest auth).
// Needs the backend to reach the device IP (same LAN / VPN / port-forward). Inbound punches use hikvisionPunch.
const crypto = require("crypto");
const http = require("http");
const https = require("https");
const Company = require("../models/Company");
const { encryptBuffer, decryptBuffer } = require("../utils/docVault");

const md5 = (s) => crypto.createHash("md5").update(s).digest("hex");

const sealPassword = (p) => encryptBuffer(Buffer.from(p, "utf8")).toString("base64");
const openPassword = (s) => decryptBuffer(Buffer.from(s, "base64")).toString("utf8");

function rawRequest(dev, method, path, headers, body) {
  return new Promise((resolve, reject) => {
    const lib = dev.https ? https : http;
    const req = lib.request(
      {
        host: dev.host,
        port: dev.port || (dev.https ? 443 : 80),
        method,
        path,
        headers,
        timeout: 15000,
        // device ships a self-signed cert; only this device is exempted
        rejectUnauthorized: false,
      },
      (res) => {
        const chunks = [];
        res.on("data", (c) => chunks.push(c));
        res.on("end", () =>
          resolve({ status: res.statusCode, headers: res.headers, body: Buffer.concat(chunks).toString("utf8") }),
        );
      },
    );
    req.on("timeout", () => req.destroy(new Error("Device did not respond (timeout). Is it reachable from the server?")));
    req.on("error", reject);
    if (body) req.write(body);
    req.end();
  });
}

// One digest-auth round trip: first call gets the 401 challenge, second answers it.
async function isapi(dev, method, path, { body, contentType } = {}) {
  const buf = body ? (Buffer.isBuffer(body) ? body : Buffer.from(body)) : null;
  const base = { ...(buf ? { "Content-Type": contentType || "application/json", "Content-Length": buf.length } : {}) };
  let r = await rawRequest(dev, method, path, base, buf);
  if (r.status !== 401) return r;
  const ch = r.headers["www-authenticate"] || "";
  const get = (k) => (ch.match(new RegExp(`${k}="?([^",]+)"?`)) || [])[1];
  const realm = get("realm"), nonce = get("nonce"), qop = get("qop") ? "auth" : "";
  if (!nonce) return r;
  const nc = "00000001", cnonce = crypto.randomBytes(8).toString("hex");
  const ha1 = md5(`${dev.username}:${realm}:${dev.password}`);
  const ha2 = md5(`${method}:${path}`);
  const response = qop
    ? md5(`${ha1}:${nonce}:${nc}:${cnonce}:${qop}:${ha2}`)
    : md5(`${ha1}:${nonce}:${ha2}`);
  let auth = `Digest username="${dev.username}", realm="${realm}", nonce="${nonce}", uri="${path}", response="${response}"`;
  if (qop) auth += `, qop=${qop}, nc=${nc}, cnonce="${cnonce}"`;
  return rawRequest(dev, method, path, { ...base, Authorization: auth }, buf);
}

async function getDevice(companyId) {
  const c = await Company.findById(companyId).select("+hikvisionDevice.passwordEnc").lean();
  const d = c?.hikvisionDevice;
  if (!d?.host || !d.username || !d.passwordEnc) return null;
  return { host: d.host, port: d.port, https: !!d.https, username: d.username, password: openPassword(d.passwordEnc) };
}

const fail = (r, what) => {
  if (r.status === 401) throw new Error("Device rejected the username/password");
  if (r.status >= 300) throw new Error(`${what} failed (HTTP ${r.status}): ${r.body.slice(0, 200)}`);
};

const testDevice = async (dev) => {
  const r = await isapi(dev, "GET", "/ISAPI/System/deviceInfo");
  fail(r, "Connect");
  return (r.body.match(/<model>([^<]+)<\/model>/) || [])[1] || "ok";
};

// Create or update the person on the device. employeeNo must equal Employee.employeeId or punches are ignored.
async function pushUser(dev, emp) {
  const body = JSON.stringify({
    UserInfo: {
      employeeNo: String(emp.employeeId),
      name: `${emp.firstName} ${emp.lastName || ""}`.trim().slice(0, 32),
      userType: "normal",
      Valid: { enable: true, beginTime: "2020-01-01T00:00:00", endTime: "2037-12-31T23:59:59", timeType: "local" },
      doorRight: "1",
      RightPlan: [{ doorNo: 1, planTemplateNo: "1" }],
    },
  });
  fail(await isapi(dev, "PUT", "/ISAPI/AccessControl/UserInfo/SetUp?format=json", { body }), "Add user");
}

// Upload a face photo (JPEG, <200KB works best) for an existing person.
async function pushFace(dev, emp, jpeg) {
  const boundary = "----hrms" + crypto.randomBytes(8).toString("hex");
  const meta = JSON.stringify({ faceLibType: "blackFD", FDID: "1", FPID: String(emp.employeeId) });
  const body = Buffer.concat([
    Buffer.from(`--${boundary}\r\nContent-Disposition: form-data; name="FaceDataRecord"\r\nContent-Type: application/json\r\n\r\n${meta}\r\n`),
    Buffer.from(`--${boundary}\r\nContent-Disposition: form-data; name="FaceImage"; filename="face.jpg"\r\nContent-Type: image/jpeg\r\n\r\n`),
    jpeg,
    Buffer.from(`\r\n--${boundary}--\r\n`),
  ]);
  fail(
    await isapi(dev, "POST", "/ISAPI/Intelligent/FDLib/FaceDataRecord?format=json", {
      body,
      contentType: `multipart/form-data; boundary=${boundary}`,
    }),
    "Upload face",
  );
}

// Fire-and-forget helper for hooks: never throws, logs only.
async function safePush(companyId, emp, jpeg) {
  try {
    const dev = await getDevice(companyId);
    if (!dev) return;
    await pushUser(dev, emp);
    if (jpeg) await pushFace(dev, emp, jpeg);
  } catch (e) {
    console.warn(`[HIKVISION] push failed for ${emp.employeeId}: ${e.message}`);
  }
}

module.exports = { sealPassword, getDevice, testDevice, pushUser, pushFace, safePush };
