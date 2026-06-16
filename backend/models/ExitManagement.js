const mongoose = require("mongoose");

const exitSchema = new mongoose.Schema(
  {
    company: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Company",
      required: true,
    },
    employee: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Employee",
      required: true,
    },
    resignationDate: { type: Date, required: true },
    lastWorkingDay: { type: Date },
    noticePeriodDays: { type: Number, default: 30 },
    reason: {
      type: String,
      enum: [
        "personal",
        "better_opportunity",
        "relocation",
        "health",
        "retirement",
        "termination",
        "contract_end",
        "other",
      ],
      required: true,
    },
    reasonDetails: { type: String, maxlength: 1000 },
    status: {
      type: String,
      enum: ["pending", "notice_period", "cleared", "completed"],
      default: "pending",
    },
    exitInterviewDone: { type: Boolean, default: false },
    exitInterviewNotes: { type: String, maxlength: 2000 },
    assetsReturned: { type: Boolean, default: false },
    assetsList: [{ name: String, returned: { type: Boolean, default: false } }],
    fnfAmount: { type: Number, default: 0 },
    fnfStatus: {
      type: String,
      enum: ["pending", "calculated", "paid"],
      default: "pending",
    },
    fnfPaidDate: { type: Date },
    fnfBreakdown: {
      pendingLeaves: { type: Number, default: 0 },
      pendingLeavesPay: { type: Number, default: 0 },
      gratuity: { type: Number, default: 0 },
      pendingSalary: { type: Number, default: 0 },
      deductions: { type: Number, default: 0 },
    },
    experienceLetterIssued: { type: Boolean, default: false },
    experienceLetterDate: { type: Date },
    initiatedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    approvedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    approvedAt: { type: Date },
  },
  { timestamps: true },
);

module.exports = mongoose.model("ExitManagement", exitSchema);
