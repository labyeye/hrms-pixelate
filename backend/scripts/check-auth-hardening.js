// Offline checks for the login hardening: pending-token 2FA, OTP attempt budget, per-account lockout and
// token revocation. Models are replaced with in-memory fakes, nothing touches a database.
//   node scripts/check-auth-hardening.js
const assert = require("assert");
const path = require("path");
const jwt = require("jsonwebtoken");
const speakeasy = require("speakeasy");

const root = path.resolve(__dirname, "..");
process.env.JWT_SECRET = process.env.JWT_SECRET || "check-secret-check-secret";

const users = [];
let lastOtp = null;
const match = (doc, filter) =>
  Object.entries(filter).every(([k, v]) => {
    if (v && typeof v === "object" && "$in" in v) return v.$in.includes(doc[k]);
    return String(doc[k]) === String(v);
  });
const q = (r) => Object.assign(Promise.resolve(r), { select: () => q(r), populate: () => q(r) });
const stub = (rel, exports) => {
  const file = require.resolve(path.join(root, rel));
  require.cache[file] = { id: file, filename: file, loaded: true, exports };
};
stub("models/User.js", {
  findOne: (f) => q(users.find((u) => match(u, f)) || null),
  findById: (id) => q(users.find((u) => String(u._id) === String(id)) || null),
});
stub("models/Employee.js", { findOne: () => q(null) });
stub("models/Subscription.js", { findOne: () => q(null) });
stub("models/Company.js", { findById: () => q(null) });
stub("services/whatsappService.js", { sendPhoneOtp: async (phone, { otp }) => (lastOtp = { phone, otp }) });
stub("services/notificationService.js", { sendPasswordResetEmail: async () => {} });

const c = require(path.join(root, "controllers/authController.js"));
const { protect } = require(path.join(root, "middleware/auth.js"));
const generateToken = require(path.join(root, "utils/generateToken.js"));

const mkUser = (o) => {
  const u = { _id: String(users.length + 1), status: "active", tokenVersion: 0, twoFactorBackupCodes: [], ...o, save: async () => u, matchPassword: async (p) => p === u.pw };
  users.push(u);
  return u;
};
const call = (handler, { body = {}, query = {}, user, headers = {} } = {}) =>
  new Promise((resolve) => {
    const res = { statusCode: 200, status(s) { this.statusCode = s; return this; }, json(b) { resolve({ status: this.statusCode, body: b }); return this; } };
    handler({ body, query, user, headers }, res, (e) => resolve({ status: res.statusCode, error: e && e.message }));
  });
const unwrap = (h) => (Array.isArray(h) ? async (req, res, next) => { for (const fn of h) await new Promise((r) => fn(req, res, (e) => { if (e) next(e); r(); })); } : h);
// login/register are [validator, handler] arrays
const login = (body) => call((req, res, next) => c.login[0](req, res, (e) => (e ? next(e) : c.login[1](req, res, next))), { body });

(async () => {
  // ---- 2FA is bound to the password step
  const secret = speakeasy.generateSecret({ length: 20 });
  const tf = mkUser({ email: "tf@x.com", pw: "Passw0rd!", twoFactorEnabled: true, twoFactorSecret: secret.base32 });
  const step1 = await login({ email: "tf@x.com", password: "Passw0rd!" });
  assert.strictEqual(step1.status, 200);
  assert.ok(step1.body.data.pendingToken, "step 1 must return a pendingToken");
  assert.strictEqual(step1.body.data.userId, undefined, "step 1 must not leak the userId");
  const code = () => speakeasy.totp({ secret: secret.base32, encoding: "base32" });
  assert.strictEqual((await call(c.verify2FA, { body: { userId: tf._id, token: code() } })).status, 400, "userId alone must not work");
  assert.strictEqual((await call(c.verify2FA, { body: { pendingToken: generateToken(tf._id), token: code() } })).status, 401, "a normal session token is not a pending token");
  assert.strictEqual((await call(c.verify2FA, { body: { pendingToken: step1.body.data.pendingToken, token: code() } })).status, 200);

  // a pending token must never act as a session
  assert.strictEqual((await call(protect, { headers: { authorization: `Bearer ${step1.body.data.pendingToken}` } })).status, 401, "pending token must not pass protect");

  // ---- token revocation
  const rv = mkUser({ email: "rv@x.com", pw: "Passw0rd!" });
  const t0 = generateToken(rv._id, rv.tokenVersion);
  assert.strictEqual((await call(protect, { headers: { authorization: `Bearer ${t0}` } })).error, undefined, "fresh token ok");
  rv.tokenVersion = 1; // what a password change does
  assert.strictEqual((await call(protect, { headers: { authorization: `Bearer ${t0}` } })).status, 401, "old token must be rejected after password change");
  assert.strictEqual((await call(protect, { headers: { authorization: `Bearer ${generateToken(rv._id, 1)}` } })).error, undefined, "new token ok");

  // ---- OTP attempt budget
  const ot = mkUser({ email: "ot@x.com", phone: "9333333333", pw: "x" });
  await call(c.sendOtp, { body: { phone: ot.phone } });
  const good = lastOtp.otp;
  for (let i = 0; i < 5; i++) assert.strictEqual((await call(c.verifyOtp, { body: { phone: ot.phone, otp: "000000" } })).status, 401);
  assert.strictEqual((await call(c.verifyOtp, { body: { phone: ot.phone, otp: good } })).status, 401, "code must be burned after 5 wrong tries");
  await call(c.sendOtp, { body: { phone: ot.phone } });
  assert.strictEqual((await call(c.verifyOtp, { body: { phone: ot.phone, otp: lastOtp.otp } })).status, 200, "a fresh code works again");

  // ---- per-account lockout
  const lk = mkUser({ email: "lk@x.com", pw: "Passw0rd!", phone: "9444444444" });
  for (let i = 0; i < 3; i++) assert.strictEqual((await login({ email: "lk@x.com", password: "wrong" })).status, 401);
  assert.strictEqual((await login({ email: "lk@x.com", password: "wrong" })).status, 429, "4th wrong password locks");
  assert.strictEqual((await login({ email: "lk@x.com", password: "Passw0rd!" })).status, 429, "locked even with the right password");
  assert.ok(Math.abs(lk.loginLockUntil - Date.now() - 30 * 60 * 1000) < 5000, "lock is 30 minutes");
  await call(c.sendOtp, { body: { phone: lk.phone } });
  assert.strictEqual((await call(c.verifyOtp, { body: { phone: lk.phone, otp: lastOtp.otp } })).status, 200, "WhatsApp OTP works while locked");
  assert.strictEqual((await login({ email: "lk@x.com", password: "Passw0rd!" })).status, 200, "OTP login lifted the lock");
  assert.strictEqual((await login({ email: "nobody@x.com", password: "whatever1" })).status, 401, "unknown user looks like a bad password");

  console.log("auth hardening checks passed");
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
