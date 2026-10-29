require("dotenv").config();

const REQUIRED_ENV = ["JWT_SECRET", "MONGO_URI"];
const missing = REQUIRED_ENV.filter((k) => !process.env[k]);
if (missing.length) {
  console.error(`[FATAL] Missing required env vars: ${missing.join(", ")}`);
  process.exit(1);
}
if (process.env.NODE_ENV === "production" && !process.env.ALLOWED_ORIGINS) {
  console.error("[FATAL] ALLOWED_ORIGINS must be set in production");
  process.exit(1);
}

const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const morgan = require("morgan");
const rateLimit = require("express-rate-limit");
const connectDB = require("./config/db");
const timeout = require("connect-timeout");
const errorHandler = require("./middleware/errorHandler");
const sanitizeRequest = require("./middleware/sanitize");
const compression = require("compression");

connectDB();
require("./utils/paymentSaga").startRefundSweep(); // keeps retrying refunds for paid-but-unprovisioned subscriptions

const { startAttendanceAutoMarkJob } = require("./jobs/attendanceAutoMark");
// Under PM2 cluster mode every worker runs this file; only worker 0 may own the hourly cron.
if (!process.env.NODE_APP_INSTANCE || process.env.NODE_APP_INSTANCE === "0")
  startAttendanceAutoMarkJob();

const app = express();

app.set("trust proxy", 1);
app.use(compression());

app.use(
  helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'"],
        styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
        fontSrc: ["'self'", "https://fonts.gstatic.com"],
        imgSrc: ["'self'", "data:", "blob:"],
        connectSrc: ["'self'"],
        frameSrc: ["'none'"],
        objectSrc: ["'none'"],
      },
    },
    hsts: { maxAge: 31536000, includeSubDomains: true },
  }),
);

const allowedOrigins = process.env.ALLOWED_ORIGINS
  ? process.env.ALLOWED_ORIGINS.split(",").map((o) => o.trim())
  : [
      "http://localhost:5173",
      "http://localhost:5174",
      "https://hrms.pixelatenest.com",
      "http://localhost:8080",
    ];

app.use(
  cors({
    origin: (origin, callback) => {
      if (!origin || allowedOrigins.includes(origin))
        return callback(null, true);
      callback(new Error("Not allowed by CORS"));
    },
    credentials: true,
  }),
);
app.use(timeout("30s"));
// Access log without query strings and with device tokens masked (they travel in the URL and must not hit the logs).
app.use(
  morgan((tokens, req, res) =>
    [
      tokens.method(req, res),
      req.originalUrl.split("?")[0].replace(/(\/device\/)[^/]+/, "$1***"),
      tokens.status(req, res),
      `${tokens["response-time"](req, res)}ms`,
    ].join(" "),
  ),
);
// rawBody is kept for the WhatsApp webhook so its X-Hub-Signature-256 can be verified.
app.use(
  express.json({
    limit: "5mb",
    verify: (req, _res, buf) => {
      if (
        req.originalUrl.includes("whatsapp-webhook") ||
        req.originalUrl.includes("razorpay-billing")
      )
        req.rawBody = buf;
    },
  }),
);
// Razorpay "payment captured" notices (see utils/paymentReconcile.js); signed with RAZORPAY_WEBHOOK_SECRET
app.post(
  "/api/webhooks/razorpay-billing",
  require("./utils/paymentReconcile").webhook,
);
app.use(sanitizeRequest); // strips $operators / dotted keys (NoSQL injection)
app.use("/uploads", ...require("./middleware/publicUploads")()); // images only; KYC/vault files need the authenticated endpoints

// Usage/health metrics for the CRM dashboard (page views, active users, crashes, API success).
const tele = require("./utils/telemetry")("CRM_API_SECRET");
app.use(tele.middleware);
app.use("/api/telemetry", tele.ingest);
app.use("/api/crm/metrics", tele.metrics);
app.use(
  "/api/crm/accounts",
  require("./utils/crmAccounts")(
    "CRM_API_SECRET",
    require("./utils/crmAdapter"),
  ),
);

app.use("/iclock", require("./routes/admsRoutes"));
app.use("/internal/stats", require("./routes/statsRoutes"));

const authRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 50,
  message: {
    success: false,
    message: "Too many auth attempts, please try again later.",
  },
});

// Per IP. A 2,000-person site behind one Wi-Fi NAT shares one IP, so large deployments raise this via API_RATE_MAX.
const apiRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: Number(process.env.API_RATE_MAX) || 5000,
});

app.use("/api/app-version", require("./routes/appVersionRoutes"));
app.use("/api/whatsapp-webhook", require("./routes/whatsappWebhookRoutes"));
app.use(
  "/api/hrms/whatsapp-webhook",
  require("./routes/whatsappWebhookRoutes"),
);
app.use("/api/company", require("./routes/companyRoutes"));

{
  console.log("[Startup] WhatsApp OTP config", {
    token: !!process.env.META_WA_TOKEN,
    phoneNumberId: !!process.env.META_WA_PHONE_ID,
    template: process.env.WHATSAPP_OTP_TEMPLATE_NAME || "neshr_otp",
    lang: process.env.WHATSAPP_OTP_TEMPLATE_LANG || "en",
  });
  console.log("[Startup] Email OTP config", {
    smtpHost: !!process.env.SMTP_HOST,
    smtpUser: !!process.env.SMTP_USER,
    smtpPass: !!process.env.SMTP_PASS,
  });
}

// Lets iOS trust this domain for passkeys (webcredentials) — see PASSKEY_RP_ID.
app.get("/.well-known/apple-app-site-association", (req, res) =>
  res.json({
    webcredentials: { apps: ["5UNNVWBHTU.com.nesthr"] },
  }),
);

app.use("/api/auth", authRateLimit, require("./routes/authRoutes"));
app.use("/api/legal", require("./routes/legalRoutes"));
app.use(apiRateLimit);
app.use("/api/dashboard", require("./routes/dashboardRoutes"));
app.use("/api/employees", require("./routes/employeeRoutes"));
app.use("/api/attendance", require("./routes/attendanceRoutes"));
app.use("/api/leaves", require("./routes/leaveRoutes"));
app.use("/api/payroll", require("./routes/payrollRoutes"));
app.use("/api/departments", require("./routes/departmentRoutes"));
app.use("/api/performance", require("./routes/performanceRoutes"));
app.use("/api/settings", require("./routes/settingRoutes"));
app.use("/api/billing", require("./routes/billingRoutes"));
app.use("/api/credits", require("./routes/creditsRoutes"));
app.use("/api/payment-methods", require("./routes/paymentMethodRoutes"));
app.use("/api/biometric", require("./routes/biometricRoutes"));
app.use("/api/holidays", require("./routes/holidayRoutes"));
app.use("/api/payroll-config", require("./routes/payrollConfigRoutes"));
app.use(
  "/api/attendance-settings",
  require("./routes/attendanceSettingsRoutes"),
);
app.use("/api/late-approvals", require("./routes/lateApprovalRoutes"));
app.use("/api/loans", require("./routes/loanRoutes"));
app.use("/api/shifts", require("./routes/shiftRoutes"));
app.use("/api/salary-heads", require("./routes/salaryHeadRoutes"));
app.use("/api/designations", require("./routes/designationRoutes"));
app.use("/api/offer-letters", require("./routes/offerLetterRoutes"));
app.use("/api/transactions", require("./routes/transactionRoutes"));
app.use("/api/push", require("./routes/pushRoutes"));
app.use("/api/exit", require("./routes/exitRoutes"));
app.use("/api/audit", require("./routes/auditRoutes"));
app.use("/api/admin", require("./routes/adminRoutes"));
app.use("/api/crm", require("./routes/crmRoutes"));
app.use("/api/support", require("./routes/supportRoutes"));
app.use("/api/documents", require("./routes/documentRoutes"));
app.use("/api/announcements", require("./routes/announcementRoutes"));
app.use("/api/tasks", require("./routes/taskRoutes"));
app.use("/api/assets", require("./routes/assetRoutes"));
app.use(
  "/api/attendance-corrections",
  require("./routes/attendanceCorrectionRoutes"),
);
app.use("/api/trash", require("./routes/trashRoutes"));

app.get("/api/health", (req, res) =>
  res.json({ status: "ok", service: "HRMS API" }),
);

app.use(errorHandler);

const PORT = process.env.PORT || 5001;
app.listen(PORT, () => console.log(`HRMS server running on port ${PORT}`));
