require("dotenv").config();
const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const morgan = require("morgan");
const rateLimit = require("express-rate-limit");
const connectDB = require("./config/db");
const errorHandler = require("./middleware/errorHandler");

connectDB();

const app = express();

app.use(
  helmet({
    contentSecurityPolicy: false,
    hsts: { maxAge: 31536000, includeSubDomains: true },
  }),
);

const allowedOrigins = process.env.ALLOWED_ORIGINS
  ? process.env.ALLOWED_ORIGINS.split(",").map((o) => o.trim())
  : [
      "http://localhost:5173",
      "http://localhost:5174",
      "https://hrms.pixelatenest.com",
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
app.use(morgan("dev"));
app.use(express.json({ limit: "5mb" }));

app.use("/iclock", require("./routes/admsRoutes"));

const authRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 50,
  message: {
    success: false,
    message: "Too many auth attempts, please try again later.",
  },
});

const apiRateLimit = rateLimit({ windowMs: 15 * 60 * 1000, max: 5000 });

app.use("/api/company", require("./routes/companyRoutes"));

app.use("/api/auth", authRateLimit, require("./routes/authRoutes"));
app.use(apiRateLimit);
app.use("/api/dashboard", require("./routes/dashboardRoutes"));
app.use("/api/employees", require("./routes/employeeRoutes"));
app.use("/api/attendance", require("./routes/attendanceRoutes"));
app.use("/api/leaves", require("./routes/leaveRoutes"));
app.use("/api/payroll", require("./routes/payrollRoutes"));
app.use("/api/recruitment", require("./routes/recruitmentRoutes"));
app.use("/api/departments", require("./routes/departmentRoutes"));
app.use("/api/performance", require("./routes/performanceRoutes"));
app.use("/api/settings", require("./routes/settingRoutes"));
app.use("/api/billing", require("./routes/billingRoutes"));
app.use("/api/payment-methods", require("./routes/paymentMethodRoutes"));
app.use("/api/biometric", require("./routes/biometricRoutes"));
app.use("/api/holidays", require("./routes/holidayRoutes"));
app.use("/api/payroll-config", require("./routes/payrollConfigRoutes"));
app.use("/api/loans", require("./routes/loanRoutes"));
app.use("/api/branches", require("./routes/branchRoutes"));
app.use("/api/shifts", require("./routes/shiftRoutes"));
app.use("/api/salary-heads", require("./routes/salaryHeadRoutes"));
app.use("/api/designations", require("./routes/designationRoutes"));
app.use("/api/offer-letters", require("./routes/offerLetterRoutes"));
app.use("/api/transactions", require("./routes/transactionRoutes"));

app.get("/api/health", (req, res) =>
  res.json({ status: "ok", service: "HRMS API" }),
);

app.use(errorHandler);

const PORT = process.env.PORT || 5001;
app.listen(PORT, () => console.log(`HRMS server running on port ${PORT}`));
