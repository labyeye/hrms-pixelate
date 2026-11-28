const mongoose = require("mongoose");

const settingSchema = new mongoose.Schema(
  {
    company: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Company",
      unique: true,
      sparse: true,
    },
    companyName: {
      type: String,
      default: "",
    },
    // New employee IDs: EMP -> EMP0001, anything else -> <prefix><number> (BSF1101).
    employeeIdPrefix: {
      type: String,
      default: "EMP",
      trim: true,
      uppercase: true,
      match: [/^[A-Z]{1,6}$/, "Prefix must be 1-6 letters"],
    },
    companyGST: {
      type: String,
      default: "",
    },
    companyAddress: {
      type: String,
      default: "",
    },
    companyPhone: {
      type: String,
      default: "",
    },
    companyEmail: {
      type: String,
      default: "",
    },
    companyWebsite: {
      type: String,
      default: "",
    },
    logoUrl: {
      type: String,
      default: "",
    },
    // ID-card design (sizes, front/back elements). Validated by utils/idCardTemplate.js before it is saved.
    idCardTemplate: { type: mongoose.Schema.Types.Mixed, default: null },
    chequeLogoX: { type: Number, default: 10 },
    chequeLogoY: { type: Number, default: 20 },
    chequeLogoW: { type: Number, default: 60 },
    chequeLogoH: { type: Number, default: 60 },
    payrollChequeTemplate: {
      type: String,
      default: "",
    },
    bankAccountName: {
      type: String,
      default: "",
    },
    bankAccountNumber: {
      type: String,
      default: "",
    },
    bankIFSC: {
      type: String,
      default: "",
    },
    bankName: {
      type: String,
      default: "",
    },
    bankBranch: {
      type: String,
      default: "",
    },

    whatsappEnabled: { type: Boolean, default: false },
    whatsappNotifyCheckIn: { type: Boolean, default: true },
    whatsappNotifyHoliday: { type: Boolean, default: true }, // holiday announcement to covered employees (HR opts in per holiday)
    whatsappNotifyCelebrations: { type: Boolean, default: true }, // birthday + wedding anniversary wishes to employees
    whatsappNotifyLeave: { type: Boolean, default: true },
    whatsappNotifyPayroll: { type: Boolean, default: true },
    whatsappSendPunchAlert: { type: String, default: "Both" },
    whatsappSendTxnAlert: { type: String, default: "Both" },
    whatsappSendLeaveAlert: { type: String, default: "Both" },
    whatsappConsolidated: { type: Boolean, default: false },
    whatsappLang: { type: String, default: "en" },

    salaryMode: {
      type: String,
      enum: ["monthly", "15day", "weekly", "custom"],
      default: "monthly",
    },
    salaryPayDay: { type: String, default: "31" },
    salaryCycleStartDay: { type: Number, min: 1, max: 31, default: 1 },
    salaryCycleEndDay: { type: Number, min: 1, max: 31, default: 31 },

    singlePunchAction: { type: String, default: "half_day" },
    doublePunchInterval: { type: Number, default: 5 },

    otEnabled: { type: Boolean, default: true },
    otRate: { type: Number, default: 0 },

    // GPS Live Tracking Add-on
    gpsLiveTrackingEnabled: { type: Boolean, default: false },
    gpsTrackingIntervalMinutes: { type: Number, default: 5 }, // ping frequency in minutes

    autoSalary: { type: Boolean, default: false },
    bioSync: { type: Boolean, default: true },
    smsEnabled: { type: Boolean, default: false },
    emailNotif: { type: Boolean, default: true },

    dashboardType: { type: String, default: "Normal" },
    timeFormat: { type: String, default: "12" },
    currency: { type: String, default: "INR" },
    state: { type: String, default: "Maharashtra" },
    empCodePrefix: { type: String, default: "" },
    empCodeSuffix: { type: String, default: "" },
    showCTC: { type: Boolean, default: false },
    branchwise: { type: Boolean, default: false },

    essEnabled: { type: Boolean, default: true },
    essAllowPunch: { type: Boolean, default: false },
    essAllowSalarySlip: { type: Boolean, default: true },
    essAllowAttendance: { type: Boolean, default: true },
    essAllowLeave: { type: Boolean, default: true },
    essAllowPayHistory: { type: Boolean, default: true },
    essAllowWorkReport: { type: Boolean, default: false },
    essAllowAdvance: { type: Boolean, default: false },
    essAllowHoliday: { type: Boolean, default: true },
    essAllowMissPunch: { type: Boolean, default: true },
    // When off, employees cannot reset/re-enroll their own face from the app (HR can still do it).
    allowEmployeeFaceReset: { type: Boolean, default: false },
  },
  { timestamps: true },
);

module.exports = mongoose.model("Setting", settingSchema);
