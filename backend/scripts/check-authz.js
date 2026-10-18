// Offline authorization check: mounts the real route files with a stubbed user lookup and asserts that an
// `employee` is rejected (403) on HR-only endpoints while an `hr_manager` gets past the guard.
// No database is touched: buffering is off, so any controller that is reached fails fast with a 500.
//   node scripts/check-authz.js
process.env.JWT_SECRET = process.env.JWT_SECRET || "authz-check-secret";
const http = require("http");
const express = require("express");
const jwt = require("jsonwebtoken");
const mongoose = require("mongoose");
mongoose.set("bufferCommands", false);

const User = require("../models/User");
const company = new mongoose.Types.ObjectId();
const roles = {
  employee: { _id: new mongoose.Types.ObjectId(), role: "employee", status: "active", company },
  hr: { _id: new mongoose.Types.ObjectId(), role: "hr_manager", status: "active", company },
};
User.findById = (id) => ({ select: async () => Object.values(roles).find((u) => String(u._id) === String(id)) || null });

const errorHandler = require("../middleware/errorHandler");
const sanitize = require("../middleware/sanitize");
const app = express();
app.use(express.json());
app.use(sanitize);
const mount = {
  "/api/shifts": "shiftRoutes", "/api/designations": "designationRoutes", "/api/salary-heads": "salaryHeadRoutes",
  "/api/offer-letters": "offerLetterRoutes", "/api/transactions": "transactionRoutes", "/api/loans": "loanRoutes",
  "/api/payment-methods": "paymentMethodRoutes", "/api/biometric": "biometricRoutes",
};
for (const [p, f] of Object.entries(mount)) app.use(p, require(`../routes/${f}`));
app.use(errorHandler);

const token = (u) => jwt.sign({ id: u._id }, process.env.JWT_SECRET);
const call = (port, method, path, who) =>
  new Promise((resolve) => {
    const req = http.request({ port, method, path, headers: { "Content-Type": "application/json", ...(who ? { Authorization: `Bearer ${token(roles[who])}` } : {}) } }, (res) => {
      res.resume();
      res.on("end", () => resolve(res.statusCode));
    });
    req.on("error", () => resolve(0));
    req.end(method === "GET" || method === "DELETE" ? undefined : "{}");
  });

// [method, path, employeeAllowed, hrAllowed = true]
const CASES = [
  ["POST", "/api/shifts", false], ["PUT", "/api/shifts/x", false], ["DELETE", "/api/shifts/x", false], ["GET", "/api/shifts", true],
  ["POST", "/api/designations", false], ["PUT", "/api/designations/x", false], ["DELETE", "/api/designations/x", false], ["GET", "/api/designations", true],
  ["GET", "/api/salary-heads", false], ["POST", "/api/salary-heads", false], ["PUT", "/api/salary-heads/x", false], ["DELETE", "/api/salary-heads/x", false],
  ["GET", "/api/offer-letters", false], ["POST", "/api/offer-letters", false],
  ["GET", "/api/transactions", false], ["POST", "/api/transactions", false], ["PUT", "/api/transactions/x", false], ["DELETE", "/api/transactions/x", false],
  ["POST", "/api/loans", false], ["PUT", "/api/loans/x/status", false], ["PUT", "/api/loans/x", false], ["DELETE", "/api/loans/x", false],
  ["POST", "/api/loans/request", true], ["GET", "/api/loans", true],
  ["POST", "/api/payment-methods", false, false], ["PATCH", "/api/payment-methods/x", false, false], ["DELETE", "/api/payment-methods/x", false, false], // super_admin only
  ["GET", "/api/biometric/face-descriptors", false], ["POST", "/api/biometric/face-attendance", false],
];

const server = app.listen(0, async () => {
  const port = server.address().port;
  let bad = 0;
  for (const [m, p, empOk, hrOk = true] of CASES) {
    const e = await call(port, m, p, "employee");
    const h = await call(port, m, p, "hr");
    const okEmp = empOk ? e !== 403 && e !== 401 : e === 403;
    const okHr = hrOk ? h !== 403 && h !== 401 : h === 403; // reached the controller (which then fails offline) = guard passed
    if (!okEmp || !okHr) bad++;
    console.log(`${okEmp && okHr ? "ok  " : "FAIL"} ${m.padEnd(6)} ${p.padEnd(34)} employee=${e} hr=${h}`);
  }
  // unauthenticated + injection payload on the device endpoint must be rejected before any DB lookup
  const inj = await new Promise((resolve) => {
    const r = http.request({ port, method: "POST", path: "/api/biometric/record", headers: { "Content-Type": "application/json" } }, (res) => resolve(res.statusCode));
    r.end(JSON.stringify({ deviceToken: { $ne: null }, method: "pin", employeeId: "x" }));
  });
  console.log(`${inj === 400 ? "ok  " : "FAIL"} operator-injection deviceToken -> ${inj} (expected 400)`);
  if (inj !== 400) bad++;
  console.log(bad ? `\n${bad} FAILED` : "\nall authz checks passed");
  server.close(() => process.exit(bad ? 1 : 0));
});
